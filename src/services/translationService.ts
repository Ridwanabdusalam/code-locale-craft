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
  private static readonly BATCH_SIZE = 50; // Reduced to 50 strings per batch for better reliability
  private static readonly MAX_RETRIES = 3;

  // Helper method to identify code-like strings that shouldn't be translated
  private static isCodeString(text: string): boolean {
    if (!text || typeof text !== 'string') return true;
    
    // Filter out CSS classes, technical terms, and code-like patterns
    const codePatterns = [
      /^[a-z-]+\d+$/i, // CSS classes like 'text-gray-600'
      /^[a-z]+-[a-z]+-\d+$/i, // More specific CSS patterns
      /\b(className|class|style|id)\b/i, // HTML/CSS attributes
      /^[A-Z_][A-Z0-9_]*$/, // Constants like 'API_KEY'
      /^[a-z]+[A-Z][a-zA-Z]*$/, // camelCase variables
      /\.(css|js|jsx|ts|tsx|html|json)$/i, // File extensions
      /^#[0-9a-fA-F]{3,6}$/, // Hex colors
      /^rgb\(|rgba\(|hsl\(|hsla\(/i, // Color functions
      /^\d+px$|^\d+%$|^\d+em$|^\d+rem$/i, // CSS units
    ];
    
    // Check if text matches any code pattern
    return codePatterns.some(pattern => pattern.test(text.trim()));
  }

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
    const totalEntries = entries.length;

    console.log(`Starting batch translation of ${totalEntries} strings to ${targetLanguage}`);

    // Process in batches with progress tracking
    for (let batchStart = 0; batchStart < totalEntries; batchStart += this.BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + this.BATCH_SIZE, totalEntries);
      const batchEntries = entries.slice(batchStart, batchEnd);
      const batchNumber = Math.floor(batchStart / this.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalEntries / this.BATCH_SIZE);

      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batchEntries.length} strings)`);

      try {
        // Separate cached and uncached strings
        const uncachedBatch: Array<[string, string]> = [];
        const cachedResults: TranslationResult[] = [];

        // Check cache for all strings in batch
        for (const [key, originalText] of batchEntries) {
          const cached = await TranslationCacheService.getCachedTranslation(originalText, targetLanguage);
          if (cached) {
            console.log(`Using cached translation for: "${originalText.substring(0, 30)}..."`);
            
            const cachedResult: TranslationResult = {
              originalText,
              translatedText: cached.translated_text,
              languageCode: targetLanguage,
              qualityScore: cached.quality_score || 0.9,
              status: 'completed'
            };
            cachedResults.push(cachedResult);

            // Save cached translation to database
            await TranslationService.saveTranslation({
              analysisId,
              translationKey: key,
              originalText,
              translatedText: cached.translated_text,
              languageCode: targetLanguage,
              qualityScore: cached.quality_score || 0.9,
              status: 'completed'
            });
          } else {
            uncachedBatch.push([key, originalText]);
          }
        }

        // Process uncached strings in batch
        if (uncachedBatch.length > 0) {
          console.log(`Translating ${uncachedBatch.length} uncached strings in batch`);
          
          const textsToTranslate = uncachedBatch.map(([_, text]) => text);
          const batchResults = await this.translateBatchWithOpenAI(
            textsToTranslate,
            targetLanguage,
            preservePlaceholders,
            maxRetries
          );

          // Process batch results
          for (let i = 0; i < uncachedBatch.length; i++) {
            const [key, originalText] = uncachedBatch[i];
            const translationResult = batchResults[i];

            if (translationResult && translationResult.status === 'completed') {
              // Validate quality
              if (translationResult.qualityScore < qualityThreshold) {
                console.warn(`Low quality translation for "${originalText.substring(0, 30)}...": ${translationResult.qualityScore}`);
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
            } else {
              // Handle failed translation
              console.error(`Translation failed for: "${originalText.substring(0, 30)}..."`);
              
              const failedResult: TranslationResult = {
                originalText,
                translatedText: originalText, // Fallback to original
                languageCode: targetLanguage,
                qualityScore: 0,
                status: 'failed',
                error: translationResult?.error || 'Translation failed'
              };
              results.push(failedResult);

              // Save failed translation to database
              await TranslationService.saveTranslation({
                analysisId,
                translationKey: key,
                originalText,
                translatedText: originalText,
                languageCode: targetLanguage,
                qualityScore: 0,
                status: 'failed'
              });
            }
          }
        }

        // Add cached results to main results
        results.push(...cachedResults);

        console.log(`✅ Batch ${batchNumber}/${totalBatches} completed: ${batchEntries.length} strings processed`);
        
        // Add small delay between batches to avoid overwhelming the API
        if (batchNumber < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ BATCH TRANSLATION ERROR for batch ${batchNumber}:`, error);
        
        // Handle batch failure - mark all strings in batch as failed but continue processing
        for (const [key, originalText] of batchEntries) {
          const failedResult: TranslationResult = {
            originalText,
            translatedText: originalText,
            languageCode: targetLanguage,
            qualityScore: 0,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          results.push(failedResult);

          // Save failed translation to database with error handling
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
            console.error(`Failed to save failed translation to database:`, dbError);
            // Continue processing even if database save fails
          }
        }
        
        // Continue to next batch instead of stopping entirely
        console.log(`⚠️ Batch ${batchNumber} failed, continuing with next batch...`);
      }
    }

    console.log(`Batch translation completed: ${results.length} results for ${targetLanguage}`);
    return results;
  }

  private static async translateBatchWithOpenAI(
    texts: string[],
    targetLanguage: string,
    preservePlaceholders: boolean,
    maxRetries: number
  ): Promise<Array<Omit<TranslationResult, 'originalText' | 'languageCode'>>> {
    let lastError: Error;
    
    // Add timeout for the entire batch operation
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Batch translation timeout after 60 seconds')), 60000);
    });
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Batch translation attempt ${attempt}/${maxRetries} for ${texts.length} texts to ${targetLanguage}`);
        
        const translationPromise = supabase.functions.invoke('translate', {
          body: {
            texts, // Send array of texts
            targetLanguage,
            preservePlaceholders
          }
        });
        
        const { data, error } = await Promise.race([translationPromise, timeoutPromise]);

        if (error) {
          throw new Error(`Translation API error: ${error.message}`);
        }

        if (!data || data.error) {
          throw new Error(data?.error || 'No data returned from translation service');
        }

        // Handle array response from batch translation
        if (Array.isArray(data)) {
          return data.map(result => ({
            translatedText: result.translatedText,
            qualityScore: result.qualityScore || 0.9,
            status: 'completed' as const
          }));
        }

        // Fallback to single result
        return [{
          translatedText: data.translatedText,
          qualityScore: data.qualityScore || 0.9,
          status: 'completed' as const
        }];

      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Batch translation attempt ${attempt}/${maxRetries} failed:`, errorMessage);
        
        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const backoffTime = Math.min(2000 * Math.pow(2, attempt) + Math.random() * 1000, 15000);
          console.log(`Retrying batch in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    // If all attempts failed, return error results for all texts
    console.error(`All batch translation attempts failed:`, lastError);
    return texts.map(() => ({
      translatedText: '',
      qualityScore: 0,
      status: 'failed' as const,
      error: lastError?.message || 'Batch translation failed'
    }));
  }

  static async generateTranslationFiles(
    analysisId: string,
    targetLanguages: Array<{ code: string; name: string }>
  ): Promise<Array<{ path: string; content: string; language: string }>> {
    const files = [];

    console.log(`Generating translation files for analysis ${analysisId}`);

    // Get all translations for this analysis
    for (const language of targetLanguages) {
      const translations = await TranslationService.getTranslations(analysisId, language.code);
      console.log(`Found ${translations.length} translations for ${language.code}`);
      
      // Build translation object using actual translated text
      const translationObj: Record<string, string> = {};
      
      if (translations.length > 0) {
        // Use actual translations from the database
        translations.forEach(t => {
          // Filter out CSS classes and code-like strings
          if (!this.isCodeString(t.original_text)) {
            translationObj[t.translation_key] = t.translated_text;
          }
        });
        console.log(`Using ${Object.keys(translationObj).length} actual translations for ${language.code}`);
      } else {
        console.warn(`No translations found in database for ${language.code}. Translation process may not have completed successfully.`);
        
        // Fallback: get extracted strings for structure, but only for English
        if (language.code === 'en') {
          const { data: extractedStrings, error: stringsError } = await supabase
            .from('extracted_strings')
            .select('translation_key, string_value')
            .eq('analysis_id', analysisId);

          if (!stringsError && extractedStrings) {
            extractedStrings.forEach(str => {
              if (str.translation_key && !this.isCodeString(str.string_value)) {
                translationObj[str.translation_key] = str.string_value;
              }
            });
          }
        }
      }

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