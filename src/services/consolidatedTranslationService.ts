
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
      const batchSize = options.batchSize || 75; // Optimal batch size for GPT-4o
      
      if (stringCount > batchSize) {
        console.log(`📦 Using batch processing: ${stringCount} strings with batch size ${batchSize}`);
        return await this.generateWithBatching(englishJson, languageCodes, options);
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

  private static async generateWithBatching(
    englishJson: Record<string, string>,
    languageCodes: string[],
    options: ConsolidatedTranslationOptions
  ): Promise<{ path: string; content: string }> {
    const batchSize = options.batchSize || 75;
    const entries = Object.entries(englishJson);
    const batches = [];
    
    // Create batches
    for (let i = 0; i < entries.length; i += batchSize) {
      const batchEntries = entries.slice(i, i + batchSize);
      const batchJson = Object.fromEntries(batchEntries);
      batches.push(batchJson);
    }
    
    console.log(`📦 Processing ${batches.length} batches of ~${batchSize} strings each`);
    
    const allTranslations: Record<string, Record<string, string>> = {};
    
    // Process batches sequentially to avoid overwhelming the API
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchKeys = Object.keys(batch);
      
      if (options.onProgress) {
        options.onProgress({
          current: i + 1,
          total: batches.length,
          message: `Translating batch ${i + 1}/${batches.length} (${batchKeys.length} strings)...`
        });
      }
      
      try {
        console.log(`🔄 Processing batch ${i + 1}/${batches.length} with ${batchKeys.length} strings`);
        
        const batchTranslations = await this.translateToConsolidatedFormat(
          batch,
          languageCodes,
          i,
          batches.length
        );
        
        // Merge batch results
        Object.keys(batch).forEach(key => {
          allTranslations[key] = {
            en: batch[key],
            ...batchTranslations[key] || {}
          };
        });
        
        console.log(`✅ Batch ${i + 1}/${batches.length} completed`);
        
        // Add delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error);
        
        // Add English-only entries for failed batch
        Object.keys(batch).forEach(key => {
          allTranslations[key] = { en: batch[key] };
        });
        
        // Continue with next batch
        continue;
      }
    }
    
    const content = JSON.stringify(allTranslations, null, 2);
    
    console.log(`🎉 Batch processing completed: ${Object.keys(allTranslations).length} keys processed`);
    
    return {
      path: 'src/i18n/translations.json',
      content
    };
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
      throw new Error(`Translation API error: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    if (!data || !data.translations) {
      throw new Error('No translation data returned from service');
    }

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
