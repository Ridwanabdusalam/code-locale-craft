import { supabase } from '@/integrations/supabase/client';

interface ConsolidatedTranslationOptions {
  preservePlaceholders?: boolean;
  qualityThreshold?: number;
  maxRetries?: number;
  batchSize?: number;
  onProgress?: (progress: { current: number; total: number; message: string }) => void;
}

interface ConsolidatedTranslationResult {
  success: boolean;
  translationsJson: Record<string, Record<string, string>>;
  error?: string;
}

export class ConsolidatedTranslationService {
  static async generateConsolidatedTranslationFile(
    englishJson: Record<string, string>,
    targetLanguages: Array<{ code: string; name: string }>,
    options: ConsolidatedTranslationOptions = {}
  ): Promise<{ path: string; content: string }> {
    console.log(`🌍 Generating consolidated translation file for ${targetLanguages.length} languages`);

    try {
      // Extract just the language codes for the API call
      const languageCodes = targetLanguages.map(lang => lang.code);
      
      // Check if we need to use batching
      const stringCount = Object.keys(englishJson).length;
      const adaptiveBatchSize = this.calculateAdaptiveBatchSize(englishJson, options.batchSize || 75);
      
      console.log(`📊 Analysis: ${stringCount} strings, adaptive batch size: ${adaptiveBatchSize}`);
      
      if (stringCount > adaptiveBatchSize) {
        console.log(`📦 Using batch processing: ${stringCount} strings with batch size ${adaptiveBatchSize}`);
        return await this.generateWithBatching(englishJson, languageCodes, {
          ...options,
          batchSize: adaptiveBatchSize
        });
      }
      
      // Single batch processing for smaller sets
      const consolidatedTranslations = await this.translateToConsolidatedFormat(
        englishJson,
        languageCodes
      );

      // Create the consolidated structure with English as the base
      const finalTranslations: Record<string, Record<string, string>> = {};
      
      // Add all keys with English as default
      Object.keys(englishJson).forEach(key => {
        finalTranslations[key] = {
          en: englishJson[key],
          ...consolidatedTranslations[key] || {}
        };
      });

      const content = JSON.stringify(finalTranslations, null, 2);

      console.log(`✅ Generated consolidated translation file with ${Object.keys(finalTranslations).length} keys`);

      return {
        path: 'src/i18n/translations.json',
        content
      };

    } catch (error) {
      console.error('❌ Failed to generate consolidated translation file:', error);
      
      // Fallback: Create file with only English translations
      const fallbackTranslations: Record<string, Record<string, string>> = {};
      Object.keys(englishJson).forEach(key => {
        fallbackTranslations[key] = { en: englishJson[key] };
      });
      
      return {
        path: 'src/i18n/translations.json',
        content: JSON.stringify(fallbackTranslations, null, 2)
      };
    }
  }

  private static calculateAdaptiveBatchSize(
    englishJson: Record<string, string>,
    defaultBatchSize: number
  ): number {
    const entries = Object.entries(englishJson);
    let totalTokens = 0;
    let longKeyCount = 0;
    
    entries.forEach(([key, value]) => {
      const keyTokens = Math.ceil(key.length / 4);
      const valueTokens = Math.ceil(value.length / 4);
      totalTokens += keyTokens + valueTokens;
      
      if (key.length > 50) {
        longKeyCount++;
      }
    });
    
    const avgTokensPerEntry = totalTokens / entries.length;
    console.log(`📏 Token analysis: avg ${avgTokensPerEntry.toFixed(1)} tokens/entry, ${longKeyCount} long keys`);
    
    // Reduce batch size if we have many long keys or high token average
    if (longKeyCount > entries.length * 0.3 || avgTokensPerEntry > 50) {
      const reducedSize = Math.max(25, Math.floor(defaultBatchSize * 0.6));
      console.log(`🔧 Reducing batch size to ${reducedSize} due to long keys/high token count`);
      return reducedSize;
    }
    
    return defaultBatchSize;
  }

  private static async generateWithBatching(
    englishJson: Record<string, string>,
    languageCodes: string[],
    options: ConsolidatedTranslationOptions
  ): Promise<{ path: string; content: string }> {
    const batchSize = options.batchSize || 75;
    const entries = Object.entries(englishJson);
    
    // Group entries intelligently - separate long keys
    const longKeyEntries = entries.filter(([key]) => key.length > 50);
    const normalEntries = entries.filter(([key]) => key.length <= 50);
    
    console.log(`🔍 Entry categorization: ${normalEntries.length} normal, ${longKeyEntries.length} long keys`);
    
    const batches = [];
    
    // Create smaller batches for long keys
    const longKeyBatchSize = Math.max(15, Math.floor(batchSize * 0.3));
    for (let i = 0; i < longKeyEntries.length; i += longKeyBatchSize) {
      const batchEntries = longKeyEntries.slice(i, i + longKeyBatchSize);
      const batchJson = Object.fromEntries(batchEntries);
      batches.push({ json: batchJson, type: 'long-keys' });
    }
    
    // Create normal batches for regular keys
    for (let i = 0; i < normalEntries.length; i += batchSize) {
      const batchEntries = normalEntries.slice(i, i + batchSize);
      const batchJson = Object.fromEntries(batchEntries);
      batches.push({ json: batchJson, type: 'normal' });
    }
    
    console.log(`📦 Created ${batches.length} batches (${batches.filter(b => b.type === 'long-keys').length} for long keys)`);
    
    const allTranslations: Record<string, Record<string, string>> = {};
    const failedKeys: string[] = [];
    let successfulBatches = 0;
    
    // Process batches sequentially to avoid overwhelming the API
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchKeys = Object.keys(batch.json);
      
      if (options.onProgress) {
        options.onProgress({
          current: i + 1,
          total: batches.length,
          message: `Translating batch ${i + 1}/${batches.length} (${batch.type}, ${batchKeys.length} strings)...`
        });
      }
      
      try {
        console.log(`🔄 Processing batch ${i + 1}/${batches.length} [${batch.type}] with ${batchKeys.length} strings`);
        
        const batchTranslations = await this.translateToConsolidatedFormat(
          batch.json,
          languageCodes,
          i,
          batches.length
        );
        
        console.log(`📋 Batch ${i + 1} response structure:`, {
          keys: Object.keys(batchTranslations),
          sampleKey: Object.keys(batchTranslations)[0],
          sampleTranslation: batchTranslations[Object.keys(batchTranslations)[0]]
        });
        
        // Validate batch results before merging
        const validatedTranslations = this.validateBatchTranslations(
          batchTranslations, 
          languageCodes, 
          batchKeys,
          i + 1
        );
        
        // Merge batch results - FIXED LOGIC
        Object.keys(batch.json).forEach(key => {
          if (validatedTranslations[key] && Object.keys(validatedTranslations[key]).length > 0) {
            // Check if we actually have translations in target languages
            const hasTranslations = languageCodes.some(lang => 
              validatedTranslations[key][lang] && validatedTranslations[key][lang] !== batch.json[key]
            );
            
            if (hasTranslations) {
              allTranslations[key] = {
                en: batch.json[key],
                ...validatedTranslations[key]
              };
              console.log(`✅ Successfully merged translations for key: ${key.substring(0, 50)}...`);
            } else {
              console.warn(`⚠️ No valid translations found for key: ${key.substring(0, 50)}...`);
              allTranslations[key] = { en: batch.json[key] };
              failedKeys.push(key);
            }
          } else {
            console.warn(`❌ Missing translations for key: ${key.substring(0, 50)}...`);
            allTranslations[key] = { en: batch.json[key] };
            failedKeys.push(key);
          }
        });
        
        successfulBatches++;
        console.log(`✅ Batch ${i + 1}/${batches.length} completed successfully`);
        
        // Add delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error);
        
        // Add English-only entries for failed batch
        Object.keys(batch.json).forEach(key => {
          allTranslations[key] = { en: batch.json[key] };
          failedKeys.push(key);
        });
        
        // Continue with next batch
        continue;
      }
    }
    
    // Final validation and reporting
    const totalKeys = Object.keys(englishJson).length;
    const translatedKeys = Object.keys(allTranslations).filter(key => 
      languageCodes.some(lang => allTranslations[key][lang] && allTranslations[key][lang] !== englishJson[key])
    ).length;
    
    console.log(`🎯 Translation Summary:`);
    console.log(`  - Total keys: ${totalKeys}`);
    console.log(`  - Successfully translated: ${translatedKeys}`);
    console.log(`  - Failed keys: ${failedKeys.length}`);
    console.log(`  - Successful batches: ${successfulBatches}/${batches.length}`);
    
    if (failedKeys.length > 0) {
      console.warn(`⚠️ Failed to translate ${failedKeys.length} keys:`, failedKeys.slice(0, 5));
    }
    
    const content = JSON.stringify(allTranslations, null, 2);
    
    console.log(`🎉 Batch processing completed: ${translatedKeys}/${totalKeys} keys successfully translated`);
    
    return {
      path: 'src/i18n/translations.json',
      content
    };
  }

  private static validateBatchTranslations(
    batchTranslations: Record<string, Record<string, string>>,
    targetLanguages: string[],
    expectedKeys: string[],
    batchNumber: number
  ): Record<string, Record<string, string>> {
    console.log(`🔍 Validating batch ${batchNumber} translations:`);
    console.log(`  - Expected keys: ${expectedKeys.length}`);
    console.log(`  - Received keys: ${Object.keys(batchTranslations).length}`);
    console.log(`  - Target languages: ${targetLanguages.join(', ')}`);
    
    const validatedTranslations: Record<string, Record<string, string>> = {};
    
    expectedKeys.forEach(key => {
      if (batchTranslations[key]) {
        const availableLanguages = Object.keys(batchTranslations[key]);
        const missingLanguages = targetLanguages.filter(lang => !availableLanguages.includes(lang));
        
        if (missingLanguages.length === 0) {
          validatedTranslations[key] = batchTranslations[key];
          console.log(`✅ Key "${key.substring(0, 30)}..." has all languages`);
        } else {
          console.warn(`⚠️ Key "${key.substring(0, 30)}..." missing languages: ${missingLanguages.join(', ')}`);
          validatedTranslations[key] = batchTranslations[key]; // Still include partial translations
        }
      } else {
        console.error(`❌ Key "${key.substring(0, 30)}..." missing from batch response`);
      }
    });
    
    return validatedTranslations;
  }

  private static async translateToConsolidatedFormat(
    englishJson: Record<string, string>,
    targetLanguages: string[],
    batchIndex?: number,
    totalBatches?: number
  ): Promise<Record<string, Record<string, string>>> {
    const batchInfo = batchIndex !== undefined ? ` (batch ${batchIndex + 1}/${totalBatches})` : '';
    console.log(`🔄 Translating to consolidated format for languages: ${targetLanguages.join(', ')}${batchInfo}`);

    const { data, error } = await supabase.functions.invoke('translate-consolidated', {
      body: {
        englishJson,
        targetLanguages,
        batchIndex,
        totalBatches,
      },
    });

    if (error) {
      console.error(`❌ Translation API error${batchInfo}:`, error);
      throw new Error(`Translation API error: ${error.message}`);
    }

    if (data?.error) {
      console.error(`❌ Translation service error${batchInfo}:`, data.error);
      throw new Error(data.error);
    }

    if (!data || !data.translations) {
      console.error(`❌ No translation data returned${batchInfo}:`, data);
      throw new Error('No translation data returned from service');
    }

    console.log(`✅ Successfully received translations${batchInfo} for ${Object.keys(data.translations).length} keys`);
    return data.translations;
  }

  static isCodeString(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    
    // Common code patterns that shouldn't be translated
    const codePatterns = [
      /^[a-zA-Z_$][a-zA-Z0-9_$]*$/, // Variable names
      /^[A-Z_][A-Z0-9_]*$/, // Constants
      /\.(js|ts|jsx|tsx|css|scss|html|json)$/, // File extensions
      /^#[0-9a-fA-F]{3,6}$/, // Hex colors
      /^\d+px$|^\d+rem$|^\d+em$|^\d+%$/, // CSS units
      /^rgb\(|^rgba\(|^hsl\(|^hsla\(/, // CSS color functions
      /^[a-z-]+:[a-z-]+$/, // CSS properties
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

  static async estimateTokenCount(text: string): Promise<number> {
    // Rough estimation: 1 token ≈ 4 characters for English text
    // This is a conservative estimate for GPT-4o
    return Math.ceil(text.length / 4);
  }

  static async validateConsolidatedStructure(
    translations: Record<string, Record<string, string>>,
    expectedLanguages: string[]
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Check if all keys have all expected languages
    Object.keys(translations).forEach(key => {
      const availableLanguages = Object.keys(translations[key]);
      const missingLanguages = expectedLanguages.filter(lang => !availableLanguages.includes(lang));
      
      if (missingLanguages.length > 0) {
        issues.push(`Key "${key}" missing languages: ${missingLanguages.join(', ')}`);
      }
    });

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}
