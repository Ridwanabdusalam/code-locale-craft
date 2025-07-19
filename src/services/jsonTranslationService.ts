
import { supabase } from '@/integrations/supabase/client';

interface TranslationRequest {
  json: Record<string, any>;
  targetLanguage: string;
}

interface TranslationResponse {
  [key: string]: string;
}

export class JsonTranslationService {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000;

  static async translateJsonObject(
    jsonObject: Record<string, any>,
    targetLanguage: string
  ): Promise<Record<string, any>> {
    console.log(`🔄 Starting JSON translation to ${targetLanguage}`);
    console.log('📝 JSON object to translate:', jsonObject);

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`📡 Translation attempt ${attempt}/${this.MAX_RETRIES} for ${targetLanguage}`);
        
        const { data, error } = await supabase.functions.invoke('translate', {
          body: {
            json: jsonObject,
            targetLanguage: targetLanguage
          }
        });

        if (error) {
          console.error(`❌ Supabase function error on attempt ${attempt}:`, error);
          lastError = error;
          continue;
        }

        if (!data) {
          console.error(`❌ No data received on attempt ${attempt}`);
          lastError = new Error('No data received from translation service');
          continue;
        }

        console.log(`✅ Translation successful for ${targetLanguage} on attempt ${attempt}`);
        console.log('📄 Translation result:', data);
        
        return data;

      } catch (error) {
        console.error(`❌ Translation attempt ${attempt} failed:`, error);
        lastError = error as Error;
        
        if (attempt < this.MAX_RETRIES) {
          console.log(`⏳ Waiting ${this.RETRY_DELAY}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    console.error(`❌ All translation attempts failed for ${targetLanguage}`);
    throw lastError || new Error(`Translation failed after ${this.MAX_RETRIES} attempts`);
  }

  static async generateTranslationFiles(
    englishJson: Record<string, any>,
    targetLanguages: Array<{ code: string; name: string }>
  ): Promise<Array<{ language: string; path: string; content: string }>> {
    console.log('🌐 Generating translation files for languages:', targetLanguages.map(l => l.code));
    
    const translationFiles = [];
    
    // Add English file first
    translationFiles.push({
      language: 'en',
      path: 'src/i18n/locales/en.json',
      content: JSON.stringify(englishJson, null, 2)
    });

    // Generate translations for other languages
    for (const language of targetLanguages) {
      if (language.code === 'en') continue;

      try {
        console.log(`🔄 Translating to ${language.name} (${language.code})`);
        const translatedJson = await this.translateJsonObject(englishJson, language.code);
        
        translationFiles.push({
          language: language.code,
          path: `src/i18n/locales/${language.code}.json`,
          content: JSON.stringify(translatedJson, null, 2)
        });
        
        console.log(`✅ Successfully translated to ${language.name}`);
      } catch (error) {
        console.error(`❌ Failed to translate to ${language.name}:`, error);
        // Continue with other languages instead of failing completely
      }
    }

    console.log(`🎉 Generated ${translationFiles.length} translation files`);
    return translationFiles;
  }
}
