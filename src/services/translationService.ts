import { TranslationService, TranslationCacheService } from './database';
import { supabase } from '@/integrations/supabase/client';

interface TranslationOptions {
  preservePlaceholders?: boolean;
  qualityThreshold?: number;
  maxRetries?: number;
}

interface TranslationResult {
  originalText: string;
  translatedText: string;
  languageCode: string;
  qualityScore: number;
  status: 'completed' | 'failed' | 'retry';
  error?: string;
}

export class AITranslationService {
  static async translateStrings(
    analysisId: string,
    strings: Record<string, string>,
    targetLanguage: string
  ): Promise<void> {
    console.log(`Starting translation of ${Object.keys(strings).length} strings to ${targetLanguage}`);

    try {
      const translatedJson = await this.translateJsonWithOpenAI(
        strings,
        targetLanguage
      );

      for (const key in translatedJson) {
        if (Object.prototype.hasOwnProperty.call(translatedJson, key)) {
          await TranslationService.saveTranslation({
            analysisId,
            translationKey: key,
            originalText: strings[key],
            translatedText: translatedJson[key],
            languageCode: targetLanguage,
            qualityScore: 0.9, // Placeholder quality score
            status: 'completed',
          });
        }
      }

      console.log(`✅ Translation to ${targetLanguage} completed`);
    } catch (error) {
      console.error(`❌ Translation to ${targetLanguage} failed:`, error);
      // Mark all strings as failed for this language
      for (const key in strings) {
        if (Object.prototype.hasOwnProperty.call(strings, key)) {
          await TranslationService.saveTranslation({
            analysisId,
            translationKey: key,
            originalText: strings[key],
            translatedText: strings[key], // Fallback to original
            languageCode: targetLanguage,
            qualityScore: 0,
            status: 'failed',
          });
        }
      }
      throw error; // Re-throw the error to be caught by the caller
    }
  }

  private static async translateJsonWithOpenAI(
    json: Record<string, string>,
    targetLanguage: string,
  ): Promise<Record<string, string>> {
    console.log(`Translating JSON to ${targetLanguage}`);

    const { data, error } = await supabase.functions.invoke('translate', {
      body: {
        json,
        targetLanguage,
      },
    });

    if (error) {
      throw new Error(`Translation API error: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    if (!data) {
      throw new Error('No data returned from translation service');
    }

    return data;
  }

  static isCodeString(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    
    // Common code patterns
    const codePatterns = [
      /^[a-zA-Z_$][a-zA-Z0-9_$]*$/, // Variable names
      /^[A-Z_][A-Z0-9_]*$/, // Constants
      /\.(js|ts|jsx|tsx|css|scss|html|json)$/, // File extensions
      /^#[0-9a-fA-F]{3,6}$/, // Hex colors
      /^\d+px$|^\d+rem$|^\d+em$|^\d+%$/, // CSS units
      /^rgb\(|^rgba\(|^hsl\(|^hsla\(/, // CSS color functions
      /^[a-z-]+:[a-z-]+$/, // CSS properties like "background-color"
      /^\.[\w-]+$|^#[\w-]+$/, // CSS selectors
      /^@[\w-]+/, // CSS at-rules
      /^\$[\w-]+/, // SCSS variables
      /^--[\w-]+/, // CSS custom properties
      /^\{.*\}$/, // JSON-like objects
      /^\[.*\]$/, // Arrays
      /^<\w+/, // HTML tags
      /^\/\w+/, // Paths
      /^https?:\/\//, // URLs
      /^\w+\(\)$/, // Function calls
      /^\w+\.\w+/, // Property access
      /^import\s|^export\s|^function\s|^class\s|^const\s|^let\s|^var\s/, // JS keywords
    ];
    
    return codePatterns.some(pattern => pattern.test(text.trim()));
  }

  static async generateTranslationFiles(
    analysisId: string,
    targetLanguages: Array<{ code: string; name: string }>
  ): Promise<Array<{ path: string; content: string; language: string }>> {
    const files = [];

    console.log(`Generating translation files for analysis ${analysisId}`);

    try {
      // Get all translations for this analysis
      for (const language of targetLanguages) {
        console.log(`Processing language: ${language.code} (${language.name})`);
        
        try {
          const translations = await TranslationService.getTranslations(analysisId, language.code);
          
          const translationObj = {};
          if (translations && translations.length > 0) {
            translations.forEach(t => {
              if (t.status === 'completed' && t.translation_key) {
                translationObj[t.translation_key] = t.translated_text || '';
              }
            });
          }

          // Validate translation object
          const translationCount = Object.keys(translationObj).length;
          if (translationCount === 0) {
            console.warn(`Warning: ${language.code} file will be empty (no valid translations found)`);
          }
          console.log(`Translation object for ${language.code}:`, JSON.stringify(translationObj, null, 2));

          // Generate file content with validation
          let content;
          try {
            content = JSON.stringify(translationObj, null, 2);
            // Validate the JSON can be parsed back
            JSON.parse(content);
          } catch (jsonError) {
            console.error(`JSON generation failed for ${language.code}:`, jsonError);
            // Create a minimal valid JSON
            content = JSON.stringify({}, null, 2);
          }
          
          files.push({
            path: `src/i18n/locales/${language.code}.json`,
            content,
            language: language.code
          });
          
          console.log(`✅ Generated ${language.code} file with ${translationCount} translations`);
          
        } catch (languageError) {
          console.error(`Failed to generate file for ${language.code}:`, languageError);
          // Create an empty file to prevent the process from failing
          files.push({
            path: `src/i18n/locales/${language.code}.json`,
            content: JSON.stringify({}, null, 2),
            language: language.code
          });
        }
      }

      console.log(`Successfully generated ${files.length} translation files`);

      if (files.length === 0 && targetLanguages.length > 0) {
        console.warn('No files were generated, creating empty files as a fallback.');
        for (const language of targetLanguages) {
          files.push({
            path: `src/i18n/locales/${language.code}.json`,
            content: JSON.stringify({}, null, 2),
            language: language.code
          });
        }
      }

      return files;
      
    } catch (error) {
      console.error('Critical error in generateTranslationFiles:', error);
      throw new Error(`Translation file generation failed: ${error.message}`);
    }
  }
}