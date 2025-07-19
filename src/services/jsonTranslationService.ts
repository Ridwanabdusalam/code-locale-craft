
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
  private static readonly MAX_REQUEST_SIZE = 50000; // 50KB limit
  private static readonly MAX_STRINGS_PER_REQUEST = 100; // Limit number of strings

  static validateRequestSize(jsonObject: Record<string, any>): boolean {
    const jsonString = JSON.stringify(jsonObject);
    const sizeInBytes = new Blob([jsonString]).size;
    
    console.log(`📏 Request size: ${sizeInBytes} bytes (${Object.keys(jsonObject).length} strings)`);
    
    if (sizeInBytes > this.MAX_REQUEST_SIZE) {
      console.warn(`⚠️ Request size ${sizeInBytes} exceeds limit ${this.MAX_REQUEST_SIZE}`);
      return false;
    }
    
    if (Object.keys(jsonObject).length > this.MAX_STRINGS_PER_REQUEST) {
      console.warn(`⚠️ String count ${Object.keys(jsonObject).length} exceeds limit ${this.MAX_STRINGS_PER_REQUEST}`);
      return false;
    }
    
    return true;
  }

  static filterTranslatableContent(jsonObject: Record<string, any>): Record<string, any> {
    const filtered = {};
    let filteredCount = 0;
    
    for (const [key, value] of Object.entries(jsonObject)) {
      if (typeof value === 'string') {
        // Use the same logic as the string extractor to filter out code
        if (!this.isCodeString(value)) {
          filtered[key] = value;
        } else {
          filteredCount++;
          console.log(`🚫 Filtered out code string: "${key}" = "${value.substring(0, 50)}..."`);
        }
      }
    }
    
    console.log(`✅ Filtered ${filteredCount} code strings, keeping ${Object.keys(filtered).length} translatable strings`);
    return filtered;
  }

  static isCodeString(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    
    const cleanText = text.trim();
    
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
      /displayName|forwardRef|React\.|\.displayName/, // React patterns
      /className|tailwind|css-/, // CSS/styling patterns
    ];
    
    // Check for Tailwind/CSS class patterns
    const tailwindPatterns = [
      /^(bg|text|border|p|m|w|h|flex|grid|absolute|relative|fixed|static|sticky)-/, // Tailwind prefixes
      /^(sm|md|lg|xl|2xl):/, // Responsive prefixes
      /^(hover|focus|active|disabled|first|last|odd|even):/, // State prefixes
      /^group-/, // Group utilities
      /^space-/, // Space utilities
      /^divide-/, // Divide utilities
    ];
    
    return codePatterns.some(pattern => pattern.test(cleanText)) ||
           tailwindPatterns.some(pattern => pattern.test(cleanText)) ||
           cleanText.includes('displayName') ||
           cleanText.includes('forwardRef') ||
           cleanText.includes('React.') ||
           cleanText.includes('className') ||
           cleanText.includes('px-') ||
           cleanText.includes('py-') ||
           cleanText.includes('bg-') ||
           cleanText.includes('text-') ||
           cleanText.includes('border-') ||
           cleanText.includes('flex') ||
           cleanText.includes('grid') ||
           cleanText.includes('transition-') ||
           cleanText.includes('duration-') ||
           cleanText.includes('ease-') ||
           cleanText.includes('group-data') ||
           cleanText.includes('peer-data');
  }

  static async translateJsonObject(
    jsonObject: Record<string, any>,
    targetLanguage: string
  ): Promise<Record<string, any>> {
    console.log(`🔄 Starting JSON translation to ${targetLanguage}`);
    console.log(`📝 Original object has ${Object.keys(jsonObject).length} strings`);

    // Filter out code strings before translation
    const filteredJson = this.filterTranslatableContent(jsonObject);
    
    if (Object.keys(filteredJson).length === 0) {
      console.warn('⚠️ No translatable content found after filtering');
      return {};
    }

    // Validate request size
    if (!this.validateRequestSize(filteredJson)) {
      throw new Error('Request too large for translation service');
    }

    console.log('📝 Filtered JSON object to translate:', filteredJson);

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`📡 Translation attempt ${attempt}/${this.MAX_RETRIES} for ${targetLanguage}`);
        
        const { data, error } = await supabase.functions.invoke('translate', {
          body: {
            json: filteredJson,
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
        console.log(`📄 Translation result has ${Object.keys(data).length} strings`);
        
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
    
    // Filter the English JSON before starting translations
    const filteredEnglishJson = this.filterTranslatableContent(englishJson);
    
    // Add English file first
    translationFiles.push({
      language: 'en',
      path: 'src/i18n/locales/en.json',
      content: JSON.stringify(filteredEnglishJson, null, 2)
    });

    // Generate translations for other languages
    for (const language of targetLanguages) {
      if (language.code === 'en') continue;

      try {
        console.log(`🔄 Translating to ${language.name} (${language.code})`);
        const translatedJson = await this.translateJsonObject(filteredEnglishJson, language.code);
        
        translationFiles.push({
          language: language.code,
          path: `src/i18n/locales/${language.code}.json`,
          content: JSON.stringify(translatedJson, null, 2)
        });
        
        console.log(`✅ Successfully translated to ${language.name}`);
      } catch (error) {
        console.error(`❌ Failed to translate to ${language.name}:`, error);
        // Create empty file instead of failing completely
        translationFiles.push({
          language: language.code,
          path: `src/i18n/locales/${language.code}.json`,
          content: JSON.stringify({}, null, 2)
        });
      }
    }

    console.log(`🎉 Generated ${translationFiles.length} translation files`);
    return translationFiles;
  }
}
