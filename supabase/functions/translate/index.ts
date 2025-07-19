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
    const { json, targetLanguage } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!json || !targetLanguage) {
      throw new Error('JSON object and target language are required');
    }

    console.log(`Translating JSON object to ${targetLanguage}`);

    const languageName = getLanguageName(targetLanguage);
    
    const systemPrompt = `You are a professional translator. Translate the values in the given JSON object to ${languageName} while preserving the keys and structure.

IMPORTANT RULES:
1. Return a valid JSON object with the same structure as the input.
2. Do not translate the keys of the JSON object.
3. Preserve any HTML tags, special characters, or formatting within the values.
4. Maintain the same tone and style as the original values.
5. For UI text, use natural, user-friendly language.`;

    const userPrompt = `Translate this JSON object:
${JSON.stringify(json, null, 2)}`;

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
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const translatedJson = JSON.parse(data.choices[0].message.content);

    return new Response(
      JSON.stringify(translatedJson),
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
        translatedText: null,
        qualityScore: 0
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

function calculateQualityScore(originalText: string, translatedText: string, targetLanguage: string): number {
  // Simple quality heuristics
  let score = 0.9; // Base score

  // Check if translation is too short/long compared to original
  const lengthRatio = translatedText.length / originalText.length;
  if (lengthRatio < 0.3 || lengthRatio > 3) {
    score -= 0.3;
  }

  // Check if translation is identical to original (likely failed)
  if (originalText === translatedText) {
    score -= 0.5;
  }

  // Check for placeholder preservation
  const originalPlaceholders = (originalText.match(/\{[^}]+\}/g) || []).length;
  const translatedPlaceholders = (translatedText.match(/\{[^}]+\}/g) || []).length;
  if (originalPlaceholders !== translatedPlaceholders) {
    score -= 0.2;
  }

  // Ensure score is between 0 and 1
  return Math.max(0, Math.min(1, score));
}