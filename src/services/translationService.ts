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
  private static readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests
  private static readonly MAX_RETRIES = 3;
  private static lastRequestTime = 0;

  static async translateStrings(
    analysisId: string,
    strings: Record<string, string>,
    targetLanguage: string,
    options: TranslationOptions = {}
  ): Promise<TranslationResult[]> {
    const {
      preservePlaceholders = true,
      qualityThreshold = 0.8,
      maxRetries = this.MAX_RETRIES
    } = options;

    const results: TranslationResult[] = [];
    const entries = Object.entries(strings);

    console.log(`Starting translation of ${entries.length} strings to ${targetLanguage}`);

    for (let i = 0; i < entries.length; i++) {
      const [key, originalText] = entries[i];
      
      console.log(`Processing string ${i + 1}/${entries.length}: "${originalText.substring(0, 50)}..."`);
      
      try {
        // Check cache first
        const cached = await TranslationCacheService.getCachedTranslation(originalText, targetLanguage);
        if (cached) {
          console.log(`Using cached translation for: "${originalText}"`);
          
          // Save to database
          await TranslationService.saveTranslation({
            analysisId,
            translationKey: key,
            originalText,
            translatedText: cached.translated_text,
            languageCode: targetLanguage,
            qualityScore: cached.quality_score || 0.9,
            status: 'completed'
          });

          results.push({
            originalText,
            translatedText: cached.translated_text,
            languageCode: targetLanguage,
            qualityScore: cached.quality_score || 0.9,
            status: 'completed'
          });
          continue;
        }

        // Rate limiting
        await this.enforceRateLimit();

        // Translate with OpenAI
        const translationResult = await this.translateWithOpenAI(
          originalText,
          targetLanguage,
          preservePlaceholders,
          maxRetries
        );

        // Validate quality
        if (translationResult.qualityScore < qualityThreshold) {
          console.warn(`Low quality translation for "${originalText}": ${translationResult.qualityScore}`);
        }

        // Cache the translation
        await TranslationCacheService.cacheTranslation({
          sourceText: originalText,
          targetLanguage,
          translatedText: translationResult.translatedText,
          qualityScore: translationResult.qualityScore
        });

        // Save to database
        await TranslationService.saveTranslation({
          analysisId,
          translationKey: key,
          originalText,
          translatedText: translationResult.translatedText,
          languageCode: targetLanguage,
          qualityScore: translationResult.qualityScore,
          status: translationResult.status
        });

        results.push({
          ...translationResult,
          originalText,
          languageCode: targetLanguage
        });

        console.log(`Translated (${i + 1}/${entries.length}): "${originalText}" -> "${translationResult.translatedText}"`);

      } catch (error) {
        console.error(`TRANSLATION ERROR for string ${i + 1}/${entries.length}: "${originalText.substring(0, 50)}...":`, error);
        console.error('Error details:', error.stack || error);
        
        results.push({
          originalText,
          translatedText: originalText, // Fallback to original
          languageCode: targetLanguage,
          qualityScore: 0,
          status: 'failed',
          error: error.message
        });

        // Save failed translation to database
        try {
          await TranslationService.saveTranslation({
            analysisId,
            translationKey: key,
            originalText,
            translatedText: originalText,
            languageCode: targetLanguage,
            qualityScore: 0,
            status: 'failed'
          });
        } catch (dbError) {
          console.error(`Failed to save translation to database:`, dbError);
        }
      }
    }

    console.log(`Translation batch completed: ${results.length} results for ${targetLanguage}`);
    return results;
  }

  private static async translateWithOpenAI(
    text: string,
    targetLanguage: string,
    preservePlaceholders: boolean,
    maxRetries: number
  ): Promise<Omit<TranslationResult, 'originalText' | 'languageCode'>> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('translate', {
          body: {
            text,
            targetLanguage,
            preservePlaceholders
          }
        });

        if (error) {
          throw new Error(`Translation API error: ${error.message}`);
        }

        if (!data || data.error) {
          throw new Error(data?.error || 'No data returned from translation service');
        }

        return {
          translatedText: data.translatedText,
          qualityScore: data.qualityScore || 0.9,
          status: 'completed' as const
        };

      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Translation attempt ${attempt}/${maxRetries} failed:`, errorMessage);
        
        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const backoffTime = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    throw lastError || new Error('Unknown error in translation service');
  }

  private static async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
      console.log(`Rate limiting: waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  static async generateTranslationFiles(
    analysisId: string,
    targetLanguages: Array<{ code: string; name: string }>
  ): Promise<Array<{ path: string; content: string; language: string }>> {
    const files = [];

    // Get all translations for this analysis
    for (const language of targetLanguages) {
      const translations = await TranslationService.getTranslations(analysisId, language.code);
      
      // Build translation object
      const translationObj: Record<string, string> = {};
      translations.forEach(t => {
        translationObj[t.translation_key] = t.translated_text;
      });

      // Generate file content
      const content = JSON.stringify(translationObj, null, 2);
      
      files.push({
        path: `src/i18n/locales/${language.code}.json`,
        content,
        language: language.code
      });
    }

    return files;
  }
}