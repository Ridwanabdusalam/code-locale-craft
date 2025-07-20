
import { supabase } from '@/integrations/supabase/client';

interface ConsolidatedTranslationOptions {
  preservePlaceholders?: boolean;
  qualityThreshold?: number;
  maxRetries?: number;
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

  private static async translateToConsolidatedFormat(
    englishJson: Record<string, string>,
    targetLanguages: string[]
  ): Promise<Record<string, Record<string, string>>> {
    console.log(`🔄 Translating to consolidated format for languages: ${targetLanguages.join(', ')}`);

    const { data, error } = await supabase.functions.invoke('translate-consolidated', {
      body: {
        englishJson,
        targetLanguages,
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
