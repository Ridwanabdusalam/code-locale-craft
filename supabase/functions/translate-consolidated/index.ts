
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

    // Enhanced input analysis
    const jsonString = JSON.stringify(englishJson);
    const estimatedTokens = Math.ceil(jsonString.length / 4);
    const batchInfo = batchIndex !== undefined ? ` (batch ${batchIndex + 1}/${totalBatches})` : '';
    const keyCount = Object.keys(englishJson).length;
    
    // Analyze key characteristics
    const keyLengths = Object.keys(englishJson).map(key => key.length);
    const avgKeyLength = keyLengths.reduce((a, b) => a + b, 0) / keyLengths.length;
    const longKeysCount = keyLengths.filter(len => len > 50).length;
    const maxKeyLength = Math.max(...keyLengths);
    
    console.log(`📏 Request analysis${batchInfo}:`);
    console.log(`  - Keys: ${keyCount}, Estimated tokens: ${estimatedTokens}`);
    console.log(`  - Key lengths: avg=${avgKeyLength.toFixed(1)}, max=${maxKeyLength}, long keys=${longKeysCount}`);
    console.log(`  - Target languages: ${targetLanguages.join(', ')}`);

    // More conservative token limit for complex batches
    const tokenLimit = longKeysCount > keyCount * 0.3 ? 40000 : 50000;
    if (estimatedTokens > tokenLimit) {
      console.error(`❌ Request too large: ${estimatedTokens} tokens (max ~${tokenLimit} for this batch type)`);
      throw new Error(`Request too large for translation service. Try smaller batches for long keys.`);
    }

    console.log(`🔄 Translating to consolidated format${batchInfo}`);

    const languageNames = targetLanguages.map(code => getLanguageName(code)).join(', ');
    
    // Enhanced system prompt with better handling for long keys
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
10. IMPORTANT: You must translate ALL keys provided - do not skip any keys regardless of their length
11. For long descriptive keys, focus on translating the VALUE accurately, not the key name

TARGET LANGUAGES: ${languageNames}
BATCH INFO: Processing ${keyCount} strings${batchInfo}`;

    const userPrompt = `Translate this English JSON object to the target languages (${targetLanguages.join(', ')}):

${JSON.stringify(englishJson, null, 2)}

Remember: 
- Return ONLY the JSON object with the "translations" key
- Do not include English in the output
- Translate ALL ${keyCount} values provided
- Focus on accuracy and natural language for each target language`;

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
        
        const responseKeyCount = Object.keys(parsedResponse.translations).length;
        console.log(`✅ Successfully parsed consolidated translations for ${responseKeyCount} keys`);
        
        // Enhanced validation
        if (responseKeyCount !== keyCount) {
          console.warn(`⚠️ Key count mismatch: expected ${keyCount}, got ${responseKeyCount}`);
        }
        
        // Validate that we got translations for all target languages
        const firstKey = Object.keys(parsedResponse.translations)[0];
        if (firstKey) {
          const availableLanguages = Object.keys(parsedResponse.translations[firstKey]);
          console.log(`🔍 Available languages in response: ${availableLanguages.join(', ')}`);
          
          const missingLanguages = targetLanguages.filter(lang => !availableLanguages.includes(lang));
          if (missingLanguages.length > 0) {
            console.warn(`⚠️ Missing translations for languages: ${missingLanguages.join(', ')}`);
          }
          
          // Check for English accidentally included
          if (availableLanguages.includes('en')) {
            console.warn(`⚠️ English found in response - this should not happen`);
          }
        }
        
        // Validate sample translations are not just English
        const sampleKeys = Object.keys(parsedResponse.translations).slice(0, 3);
        sampleKeys.forEach(key => {
          const originalValue = englishJson[key];
          targetLanguages.forEach(lang => {
            const translatedValue = parsedResponse.translations[key]?.[lang];
            if (translatedValue === originalValue) {
              console.warn(`⚠️ Possible untranslated content for ${lang}: "${key.substring(0, 30)}..."`);
            }
          });
        });
        
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
