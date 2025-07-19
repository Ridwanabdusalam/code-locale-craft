
import { supabase } from '@/integrations/supabase/client';

interface JsonTranslationResult {
  originalJson: Record<string, any>;
  translatedJson: Record<string, any>;
  targetLanguage: string;
  success: boolean;
  error?: string;
}

export class JsonTranslationService {
  static async translateJsonFile(
    jsonObject: Record<string, any>,
    targetLanguage: string,
    maxRetries: number = 3
  ): Promise<JsonTranslationResult> {
    let lastError: Error = new Error('Translation failed');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 JSON translation attempt ${attempt}/${maxRetries} for ${targetLanguage}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60-second timeout

        const { data, error } = await supabase.functions.invoke('translate', {
          body: {
            jsonObject,
            targetLanguage,
          },
          signal: controller.signal,
        } as any);

        clearTimeout(timeoutId);

        if (error) {
          throw new Error(`Translation API error: ${error.message}`);
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (!data || !data.success) {
          throw new Error('No data returned from translation service');
        }

        console.log(`✅ JSON translation successful for ${targetLanguage}`);

        return {
          originalJson: jsonObject,
          translatedJson: data.translatedJson,
          targetLanguage,
          success: true,
        };

      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`JSON translation attempt ${attempt}/${maxRetries} failed:`, errorMessage);

        if (attempt < maxRetries) {
          const backoffTime = Math.min(2000 * 2 ** attempt + Math.random() * 1000, 30000);
          console.log(`Retrying JSON translation in ${backoffTime.toFixed(0)}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    console.error(`All JSON translation attempts failed:`, lastError);
    return {
      originalJson: jsonObject,
      translatedJson: jsonObject, // Fallback to original
      targetLanguage,
      success: false,
      error: lastError?.message || 'Translation failed after all retries',
    };
  }

  static async generateTranslationFiles(
    analysisId: string,
    englishJson: Record<string, any>,
    targetLanguages: Array<{ code: string; name: string }>
  ): Promise<Array<{ path: string; content: string; language: string }>> {
    const files = [];

    console.log(`Generating JSON translation files for analysis ${analysisId}`);

    // First, create the English file
    files.push({
      path: `src/i18n/locales/en.json`,
      content: JSON.stringify(englishJson, null, 2),
      language: 'en'
    });

    // Then translate to each target language
    for (const language of targetLanguages) {
      if (language.code === 'en') continue; // Skip English, already added

      console.log(`Translating to ${language.code} (${language.name})`);
      
      try {
        const result = await this.translateJsonFile(englishJson, language.code);
        
        if (result.success) {
          files.push({
            path: `src/i18n/locales/${language.code}.json`,
            content: JSON.stringify(result.translatedJson, null, 2),
            language: language.code
          });
          console.log(`✅ Generated ${language.code} file successfully`);
        } else {
          console.warn(`❌ Failed to translate ${language.code}: ${result.error}`);
          // Create empty file as fallback
          files.push({
            path: `src/i18n/locales/${language.code}.json`,
            content: JSON.stringify({}, null, 2),
            language: language.code
          });
        }
        
      } catch (error) {
        console.error(`Failed to translate ${language.code}:`, error);
        // Create empty file as fallback
        files.push({
          path: `src/i18n/locales/${language.code}.json`,
          content: JSON.stringify({}, null, 2),
          language: language.code
        });
      }
    }

    console.log(`Successfully generated ${files.length} translation files`);
    return files;
  }
}
