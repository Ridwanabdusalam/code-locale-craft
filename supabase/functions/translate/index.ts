
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
    const { jsonObject, targetLanguage } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!jsonObject || !targetLanguage) {
      throw new Error('JSON object and target language are required');
    }

    console.log(`Translating JSON object to ${targetLanguage}`);

    const languageName = getLanguageName(targetLanguage);
    
    // Create system prompt for JSON translation
    const systemPrompt = `You are a professional translator. Translate the JSON object to ${languageName} while preserving the exact same structure and keys.

CRITICAL RULES:
1. ONLY translate the string values, NEVER translate the keys
2. Preserve the exact same JSON structure and nesting
3. Keep all keys in English exactly as they are
4. If you see placeholder patterns like {{variable}} or {variable}, keep them exactly as they are
5. Preserve any HTML tags, special characters, or formatting within the values
6. Maintain the same tone and style as the original
7. For UI text, use natural, user-friendly language
8. Return only valid JSON, no explanations or markdown
9. Do not add or remove any keys from the structure

Example:
Input: {"button": {"submit": "Submit"}, "message": "Hello {{name}}"}
Output: {"button": {"submit": "Enviar"}, "message": "Hola {{name}}"}`;

    const userPrompt = `Translate this JSON object to ${languageName}:\n\n${JSON.stringify(jsonObject, null, 2)}`;

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
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let rawResponse = data.choices[0].message.content.trim();

    // Clean up the response to ensure it's valid JSON
    rawResponse = rawResponse.replace(/```json\n?/, '').replace(/```\n?$/, '');

    let translatedJson;
    try {
      translatedJson = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Raw response:', rawResponse);
      throw new Error('Failed to parse translation response as valid JSON');
    }

    // Validate that the structure matches the original
    if (!validateJsonStructure(jsonObject, translatedJson)) {
      console.warn('Translation structure mismatch, using fallback');
      // Fallback: return original with a warning
      translatedJson = jsonObject;
    }

    console.log(`Translation completed for ${targetLanguage}`);

    return new Response(
      JSON.stringify({
        translatedJson,
        originalJson: jsonObject,
        targetLanguage,
        success: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Translation error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        translatedJson: null,
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

function validateJsonStructure(original: any, translated: any): boolean {
  if (typeof original !== typeof translated) {
    return false;
  }

  if (typeof original === 'object' && original !== null) {
    const originalKeys = Object.keys(original).sort();
    const translatedKeys = Object.keys(translated).sort();
    
    if (originalKeys.length !== translatedKeys.length) {
      return false;
    }
    
    for (let i = 0; i < originalKeys.length; i++) {
      if (originalKeys[i] !== translatedKeys[i]) {
        return false;
      }
      
      if (!validateJsonStructure(original[originalKeys[i]], translated[translatedKeys[i]])) {
        return false;
      }
    }
  }

  return true;
}
