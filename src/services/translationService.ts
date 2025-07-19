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
  public static isCodeString(text: string): boolean {
    if (!text || typeof text !== 'string') return true;
    
    const trimmedText = text.trim();
    
    // Skip very short strings (likely abbreviations or codes)
    if (trimmedText.length <= 2) return true;
    
    // Filter out CSS classes, technical terms, and code-like patterns
    const codePatterns = [
      // CSS classes and patterns
      /^[a-z-]+\d+$/i, // CSS classes like 'text-gray-600'
      /^[a-z]+-[a-z]+-\d+$/i, // More specific CSS patterns
      /^(bg|text|border|p|m|w|h|flex|grid|gap)-/i, // Common Tailwind prefixes
      /\b(className|class|style|id)\b/i, // HTML/CSS attributes
      
      // Programming patterns
      /^[A-Z_][A-Z0-9_]*$/, // Constants like 'API_KEY'
      /^[a-z]+[A-Z][a-zA-Z]*$/, // camelCase variables
      /^[A-Z][a-zA-Z]*Component$/, // React components
      /\.(css|js|jsx|ts|tsx|html|json|svg|png|jpg|gif)$/i, // File extensions
      
      // Colors and units
      /^#[0-9a-fA-F]{3,6}$/, // Hex colors
      /^rgb\(|rgba\(|hsl\(|hsla\(/i, // Color functions
      /^\d+px$|^\d+%$|^\d+em$|^\d+rem$|^\d+vh$|^\d+vw$/i, // CSS units
      
      // Technical strings
      /^[a-z0-9-]{8,}$/i, // Long kebab-case strings (likely IDs or technical)
      /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/, // Dot notation (like object.property)
      /^\$\{.*\}$/, // Template literals
      /^<[^>]+>.*<\/[^>]+>$/, // HTML tags
      /^\/[^\/\s]*/, // Paths starting with /
      
      // Common non-translatable patterns
      /^(true|false|null|undefined)$/i, // Boolean/null values
      /^\d+(\.\d+)?$/, // Pure numbers
      /^[a-f0-9]{8,}$/i, // Hash-like strings
    ];
    
    // Check if text matches any code pattern
    const isCode = codePatterns.some(pattern => pattern.test(trimmedText));
    
    // Additional check: if text is all uppercase and contains underscores, likely a constant
    if (!isCode && /^[A-Z_0-9]+$/.test(trimmedText) && trimmedText.includes('_')) {
      return true;
    }
    
    // Additional check: if text contains only special characters and numbers
    if (!isCode && /^[^a-zA-Z]*$/.test(trimmedText)) {
      return true;
    }
    
    return isCode;
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
          
          // Filter out code strings before translation
          const filteredBatch: Array<[string, string, boolean]> = uncachedBatch.map(([key, text]) => {
            const isCode = this.isCodeString(text);
            return [key, text, isCode];
          });
          
          const textsToTranslate = filteredBatch
            .filter(([_, __, isCode]) => !isCode)
            .map(([_, text]) => text);
          
          console.log(`${filteredBatch.length - textsToTranslate.length} code strings skipped, ${textsToTranslate.length} strings to translate`);
          
          let batchResults: Array<Omit<TranslationResult, 'originalText' | 'languageCode'>> = [];
          
          if (textsToTranslate.length > 0) {
            batchResults = await this.translateBatchWithOpenAI(
              textsToTranslate,
              targetLanguage,
              preservePlaceholders,
              maxRetries
            );
          }

          // Process all results (both translated and code strings)
          let translationIndex = 0;
          for (let i = 0; i < filteredBatch.length; i++) {
            const [key, originalText, isCode] = filteredBatch[i];
            
            let result: TranslationResult;
            
            if (isCode) {
              // Code strings are intentionally not translated
              console.log(`Code string detected, keeping original: "${originalText.substring(0, 30)}..."`);
              result = {
                originalText,
                translatedText: originalText,
                languageCode: targetLanguage,
                qualityScore: 1.0, // High quality since it's correctly not translated
                status: 'completed' // Mark as completed, not failed
              };
            } else {
              // Handle translated strings
              const translationResult = batchResults[translationIndex++];
              
              if (translationResult && translationResult.status === 'completed') {
                // Check if translation actually changed the text
                const actuallyTranslated = translationResult.translatedText !== originalText;
                
                if (!actuallyTranslated) {
                  console.log(`Text unchanged by translation (likely technical): "${originalText.substring(0, 30)}..."`);
                }
                
                // Validate quality
                if (translationResult.qualityScore < qualityThreshold) {
                  console.warn(`Low quality translation for "${originalText.substring(0, 30)}...": ${translationResult.qualityScore}`);
                }

                result = {
                  originalText,
                  translatedText: translationResult.translatedText,
                  languageCode: targetLanguage,
                  qualityScore: translationResult.qualityScore,
                  status: 'completed'
                };
              } else {
                // Handle actual translation failure
                console.error(`Translation failed for: "${originalText.substring(0, 30)}..."`);
                
                result = {
                  originalText,
                  translatedText: originalText, // Fallback to original
                  languageCode: targetLanguage,
                  qualityScore: 0,
                  status: 'failed',
                  error: translationResult?.error || 'Translation failed'
                };
              }
            }
            
            // Cache successful translations (including code strings)
            if (result.status === 'completed') {
              await TranslationCacheService.cacheTranslation({
                sourceText: originalText,
                targetLanguage,
                translatedText: result.translatedText,
                qualityScore: result.qualityScore
              });
            }

            // Save to database
            await TranslationService.saveTranslation({
              analysisId,
              translationKey: key,
              originalText,
              translatedText: result.translatedText,
              languageCode: targetLanguage,
              qualityScore: result.qualityScore,
              status: result.status
            });

            results.push(result);
          }
        }

        // Add cached results to main results
        results.push(...cachedResults);

        console.log(`✅ Batch ${batchNumber}/${totalBatches} completed: ${batchEntries.length} strings processed`);
        
        // Add small delay between batches to avoid overwhelming the API
        if (batchNumber < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay
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
    let lastError: Error = new Error('Batch translation failed');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Batch translation attempt ${attempt}/${maxRetries} for ${texts.length} texts to ${targetLanguage}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60-second timeout

        const { data, error } = await supabase.functions.invoke('translate', {
          body: {
            texts,
            targetLanguage,
            preservePlaceholders,
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

        if (!data) {
          throw new Error('No data returned from translation service');
        }

        if (Array.isArray(data)) {
          return data.map(result => ({
            translatedText: result.translatedText,
            qualityScore: result.qualityScore || 0.9,
            status: 'completed' as const,
          }));
        }

        return [{
          translatedText: data.translatedText,
          qualityScore: data.qualityScore || 0.9,
          status: 'completed' as const,
        }];

      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Batch translation attempt ${attempt}/${maxRetries} failed:`, errorMessage);

        if (attempt < maxRetries) {
          const backoffTime = Math.min(2000 * 2 ** attempt + Math.random() * 1000, 30000);
          console.log(`Retrying batch in ${backoffTime.toFixed(0)}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    console.error(`All batch translation attempts failed:`, lastError);
    return texts.map(() => ({
      translatedText: '',
      qualityScore: 0,
      status: 'failed' as const,
      error: lastError?.message || 'Batch translation failed after all retries',
    }));
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