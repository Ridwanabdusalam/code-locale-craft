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
    const { texts, targetLanguage, preservePlaceholders = true } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Support both single text and batch processing
    const textArray = Array.isArray(texts) ? texts : [texts];
    const isBatch = Array.isArray(texts);
    
    if (!textArray.length || !targetLanguage) {
      throw new Error('Texts and target language are required');
    }

    console.log(`Translating ${textArray.length} texts to ${targetLanguage}`);

    // Process placeholders for all texts
    const processedTexts = textArray.map((text, index) => {
      const placeholders: string[] = [];
      let processed = text;
      
      if (preservePlaceholders) {
        const placeholderRegex = /\{[^}]+\}/g;
        const matches = text.match(placeholderRegex);
        if (matches) {
          matches.forEach((match, matchIndex) => {
            const placeholder = `PLACEHOLDER_${index}_${matchIndex}`;
            placeholders.push(match);
            processed = processed.replace(match, placeholder);
          });
        }
      }
      
      return { original: text, processed, placeholders };
    });

    const languageName = getLanguageName(targetLanguage);
    
    // Create batch translation prompt
    let systemPrompt, userPrompt;
    
    if (isBatch) {
      systemPrompt = `You are a professional translator. Translate the given texts to ${languageName} while preserving the original meaning, tone, and context. 

IMPORTANT RULES:
1. Return translations as a JSON array in the exact same order as provided
2. Maintain the same formatting and structure for each text
3. If you see PLACEHOLDER_X_Y patterns, keep them exactly as they are
4. Preserve any HTML tags, special characters, or formatting
5. Maintain the same tone and style as the original
6. For UI text, use natural, user-friendly language
7. Your response must be a valid JSON array like ["translation1", "translation2", ...]`;

      userPrompt = `Translate these ${textArray.length} texts:
${processedTexts.map((item, index) => `${index + 1}. "${item.processed}"`).join('\n')}`;
    } else {
      systemPrompt = `You are a professional translator. Translate the given text to ${languageName} while preserving the original meaning, tone, and context. 

IMPORTANT RULES:
1. Only return the translated text, no explanations
2. Maintain the same formatting and structure
3. If you see PLACEHOLDER_X_Y patterns, keep them exactly as they are
4. Preserve any HTML tags, special characters, or formatting
5. Maintain the same tone and style as the original
6. For UI text, use natural, user-friendly language`;

      userPrompt = `Translate this text: "${processedTexts[0].processed}"`;
    }

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
        max_tokens: isBatch ? Math.min(8000, textArray.join('').length * 3) : 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let rawResponse = data.choices[0].message.content.trim();

    // Parse translations
    let translations: string[];
    
    if (isBatch) {
      try {
        // Try to parse as JSON array first
        const parsed = JSON.parse(rawResponse);
        if (Array.isArray(parsed)) {
          translations = parsed;
        } else {
          throw new Error('Response is not an array');
        }
      } catch {
        // Fallback: split by lines and clean up
        console.warn('Failed to parse JSON, falling back to line parsing');
        translations = rawResponse
          .split('\n')
          .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["']|["']$/g, '').trim())
          .filter(line => line.length > 0);
      }
      
      // Ensure we have the right number of translations
      if (translations.length !== textArray.length) {
        console.warn(`Expected ${textArray.length} translations, got ${translations.length}`);
        // Pad or truncate to match
        while (translations.length < textArray.length) {
          translations.push(textArray[translations.length] || '');
        }
        translations = translations.slice(0, textArray.length);
      }
    } else {
      translations = [rawResponse];
    }

    // Restore placeholders for each translation
    const finalTranslations = translations.map((translation, index) => {
      let final = translation;
      const { placeholders } = processedTexts[index];
      
      if (preservePlaceholders && placeholders.length > 0) {
        placeholders.forEach((placeholder, placeholderIndex) => {
          final = final.replace(`PLACEHOLDER_${index}_${placeholderIndex}`, placeholder);
        });
      }
      
      return final;
    });

    // Calculate quality scores and build results
    const results = finalTranslations.map((translation, index) => {
      const qualityScore = calculateQualityScore(textArray[index], translation, targetLanguage);
      return {
        translatedText: translation,
        qualityScore,
        originalText: textArray[index],
        targetLanguage
      };
    });

    console.log(`Translation completed for ${results.length} texts`);

    // Return single result or array based on input
    const responseData = isBatch ? results : results[0];

    return new Response(
      JSON.stringify(responseData),
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