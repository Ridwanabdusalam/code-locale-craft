
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
    console.log('📥 Received request:', JSON.stringify(requestBody, null, 2));

    const { json, targetLanguage } = requestBody;

    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    if (!json || !targetLanguage) {
      console.error('❌ Missing required parameters:', { json: !!json, targetLanguage: !!targetLanguage });
      throw new Error('JSON object and target language are required');
    }

    console.log(`🔄 Translating JSON object to ${targetLanguage}`);
    console.log('📝 JSON to translate:', json);

    const languageName = getLanguageName(targetLanguage);
    
    const systemPrompt = `You are a professional translator. Translate the values in the given JSON object to ${languageName} while preserving the keys and structure exactly.

CRITICAL RULES:
1. Return ONLY a valid JSON object with the exact same structure as the input
2. Do NOT translate the keys of the JSON object - only translate the values
3. Preserve any HTML tags, special characters, or formatting within the values
4. Maintain the same tone and style as the original values
5. For UI text, use natural, user-friendly language
6. Do NOT add any explanatory text or comments - return ONLY the JSON object
7. Ensure the output is valid JSON that can be parsed directly`;

    const userPrompt = `Translate this JSON object to ${languageName}:
${JSON.stringify(json, null, 2)}

Remember: Return ONLY the translated JSON object with the same structure and keys.`;

    console.log('📤 Sending request to OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 OpenAI response:', data);

    const translatedContent = data.choices[0].message.content;
    console.log('📝 Raw translation content:', translatedContent);

    let translatedJson;
    try {
      translatedJson = JSON.parse(translatedContent);
      console.log('✅ Successfully parsed translated JSON:', translatedJson);
    } catch (parseError) {
      console.error('❌ Failed to parse translation as JSON:', parseError);
      console.error('📝 Raw content that failed to parse:', translatedContent);
      throw new Error('Failed to parse translation response as valid JSON');
    }

    return new Response(
      JSON.stringify(translatedJson),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Translation error:', error);
    
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
