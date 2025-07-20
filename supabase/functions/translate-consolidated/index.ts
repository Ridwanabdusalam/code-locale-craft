
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('📥 Received consolidated translation request');

    const { englishJson, targetLanguages, batchIndex, totalBatches } = requestBody;

    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    if (!englishJson || !targetLanguages || !Array.isArray(targetLanguages)) {
      console.error('❌ Missing required parameters:', { 
        englishJson: !!englishJson, 
        targetLanguages: !!targetLanguages && Array.isArray(targetLanguages)
      });
      throw new Error('English JSON object and target languages array are required');
    }

    // Validate input size  
    const jsonString = JSON.stringify(englishJson);
    const estimatedTokens = Math.ceil(jsonString.length / 4);
    const batchInfo = batchIndex !== undefined ? ` (batch ${batchIndex + 1}/${totalBatches})` : '';
    console.log(`📏 Request size: ${estimatedTokens} estimated tokens for ${Object.keys(englishJson).length} strings${batchInfo}`);

    if (estimatedTokens > 50000) { // More conservative limit for batched processing
      console.error(`❌ Request too large: ${estimatedTokens} tokens (max ~50k for batched processing)`);
      throw new Error('Request too large for translation service');
    }

    console.log(`🔄 Translating to consolidated format for languages: ${targetLanguages.join(', ')}${batchInfo}`);

    const languageNames = targetLanguages.map(code => getLanguageName(code)).join(', ');
    
    const systemPrompt = `You are a professional translator. You will receive a JSON object with English text values and need to create a consolidated translation structure.

CRITICAL RULES:
1. Return ONLY a valid JSON object with this exact structure:
   {
     "translations": {
       "original_key": {
         "${targetLanguages[0]}": "translated_text_in_${getLanguageName(targetLanguages[0])}",
         "${targetLanguages[1] || ''}": "translated_text_in_${getLanguageName(targetLanguages[1] || '')}",
         ...
       }
     }
   }

2. Do NOT include English ("en") in the output - only the target languages: ${targetLanguages.join(', ')}
3. Do NOT translate the keys of the JSON object - only translate the values
4. Preserve any HTML tags, special characters, or formatting within the values
5. Maintain the same tone and style as the original English values
6. For UI text, use natural, user-friendly language appropriate for each target language
7. If a value appears to be technical content (like CSS classes, code, or configuration), do NOT translate it - keep it exactly as is
8. Ensure the output is valid JSON that can be parsed directly
9. Do NOT add any explanatory text or comments - return ONLY the JSON object with the "translations" key

TARGET LANGUAGES: ${languageNames}`;

    const userPrompt = `Translate this English JSON object to the target languages (${targetLanguages.join(', ')}):

${JSON.stringify(englishJson, null, 2)}

Remember: Return ONLY the JSON object with the "translations" key containing the consolidated translation structure. Do not include English in the output.`;

    console.log('📤 Sending request to OpenAI GPT-4o...');
    
    // Add timeout to the fetch request
    const timeoutMs = 300000; // 5 minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 16000,
          response_format: { type: "json_object" },
        }),
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ OpenAI API error:', errorData);
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('📥 GPT-4o response received, processing...');

      const responseContent = data.choices[0].message.content;
      console.log(`📝 Translation content length: ${responseContent.length} characters`);

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseContent);
        
        if (!parsedResponse.translations) {
          throw new Error('Response missing "translations" key');
        }
        
        console.log(`✅ Successfully parsed consolidated translations for ${Object.keys(parsedResponse.translations).length} keys`);
        
        // Validate that we got translations for all target languages
        const firstKey = Object.keys(parsedResponse.translations)[0];
        if (firstKey) {
          const availableLanguages = Object.keys(parsedResponse.translations[firstKey]);
          console.log(`🔍 Available languages in response: ${availableLanguages.join(', ')}`);
          
          const missingLanguages = targetLanguages.filter(lang => !availableLanguages.includes(lang));
          if (missingLanguages.length > 0) {
            console.warn(`⚠️ Missing translations for languages: ${missingLanguages.join(', ')}`);
          }
        }
        
      } catch (parseError) {
        console.error('❌ Failed to parse translation as JSON:', parseError);
        console.error('📝 Raw content that failed to parse (first 2000 chars):', responseContent.substring(0, 2000));
        throw new Error('Failed to parse translation response as valid JSON');
      }

      return new Response(
        JSON.stringify(parsedResponse),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Translation request timed out. Try with smaller batches.');
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('❌ Consolidated translation error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function getLanguageName(code: string): string {
  const languageMap: Record<string, string> = {
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'tr': 'Turkish',
    'pl': 'Polish',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'cs': 'Czech',
    'hu': 'Hungarian'
  };

  return languageMap[code] || code;
}
