class I18nGenerator {
  constructor(framework = 'React') {
    this.framework = framework;
  }

  // Generate consolidated i18n configuration file
  generateConsolidatedI18nConfig() {
    if (this.framework === 'React') {
      return `import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import the consolidated translations file
import consolidatedTranslations from './translations.json';

// Transform consolidated structure to react-i18next format
function transformConsolidatedTranslations(consolidated) {
  const resources = {};
  
  // Extract all available languages from the consolidated structure
  const allLanguages = new Set();
  Object.values(consolidated).forEach(translations => {
    Object.keys(translations).forEach(lang => allLanguages.add(lang));
  });
  
  // Create resources for each language
  allLanguages.forEach(language => {
    resources[language] = {
      translation: {}
    };
    
    // Transform each key from consolidated format to flat format
    Object.keys(consolidated).forEach(key => {
      if (consolidated[key][language]) {
        resources[language].translation[key] = consolidated[key][language];
      }
    });
  });
  
  return resources;
}

// Transform the consolidated translations
const resources = transformConsolidatedTranslations(consolidatedTranslations);

console.log('🌍 Available languages:', Object.keys(resources));

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

export default i18n;
`;
    }
    
    return '';
  }

  // Generate translation JSON file
  generateTranslationFile(strings, language = 'en') {
    const translations = {};
    
    strings.forEach(stringData => {
      const keys = stringData.key.split('.');
      let current = translations;
      
      // Create nested structure
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      // Set the final value
      current[keys[keys.length - 1]] = language === 'en' ? stringData.text : '';
    });
    
    return JSON.stringify(translations, null, 2);
  }

  // Generate empty translation file for other languages
  async generateEmptyTranslationFile(strings, language, batchSize = 50) {
    const translations = {};
    const stringBatches = [];

    // Create batches of strings
    for (let i = 0; i < strings.length; i += batchSize) {
      stringBatches.push(strings.slice(i, i + batchSize));
    }

    // Process batches in parallel
    await Promise.all(stringBatches.map(async (batch) => {
      try {
        const translatedBatch = await this.translateBatch(batch, language);

        translatedBatch.forEach((translatedData) => {
          const { key, translatedText } = translatedData;
          const keys = key.split('.');
          let current = translations;

          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = translatedText;
        });
      } catch (error) {
        console.error(`Error translating batch for ${language}:`, error);
        // Even if a batch fails, create empty entries for them
        batch.forEach((stringData) => {
          const keys = stringData.key.split('.');
          let current = translations;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = ''; // Fallback to empty string
        });
      }
    }));

    return JSON.stringify(translations, null, 2);
  }

  // Helper function to translate a batch of strings
  async translateBatch(batch, language) {
    // This is a placeholder for your actual translation service call
    // Replace with your Supabase edge function call
    console.log(`Translating batch of ${batch.length} strings to ${language}`);

    // Simulate API call
    return new Promise(resolve => {
      setTimeout(() => {
        const translatedBatch = batch.map(stringData => ({
          ...stringData,
          translatedText: `[${language}] ${stringData.text}`, // Mock translation
        }));
        resolve(translatedBatch);
      }, 1000);
    });
  }

  // Generate Language Switcher component
  generateLanguageSwitcher() {
    if (this.framework === 'React') {
      return `import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages } from 'lucide-react';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  // Add more languages as needed
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (languageCode) => {
    i18n.changeLanguage(languageCode);
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Languages className="h-4 w-4" />
          {currentLanguage.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border shadow-md">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className="cursor-pointer hover:bg-muted"
          >
            {language.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;
`;
    }
    
    return '';
  }

  // Generate custom hook for translations
  generateTranslationHook() {
    if (this.framework === 'React') {
      return `import { useTranslation as useI18nTranslation } from 'react-i18next';

export function useTranslation() {
  const { t, i18n } = useI18nTranslation();

  return {
    t,
    language: i18n.language,
    changeLanguage: i18n.changeLanguage,
    isLoading: !i18n.isInitialized,
  };
}

export default useTranslation;
`;
    }
    
    return '';
  }

  // Generate i18next scanner configuration
  generateScannerConfig() {
    return `module.exports = {
  input: [
    'src/**/*.{js,jsx,ts,tsx}',
    // Include other file patterns as needed
  ],
  output: './',
  options: {
    debug: true,
    func: {
      list: ['i18next.t', 'i18n.t', 't'],
      extensions: ['.js', '.jsx', '.ts', '.tsx']
    },
    lngs: ['en'],
    defaultLng: 'en',
    resource: {
      loadPath: 'src/i18n/locales/{{lng}}.json',
      savePath: 'src/i18n/locales/{{lng}}.json',
      jsonIndent: 2,
      lineEnding: '\\n'
    },
    nsSeparator: false,
    keySeparator: '.',
    interpolation: {
      prefix: '{{',
      suffix: '}}'
    }
  }
};
`;
  }

  // Generate development scripts for package.json
  generateScripts() {
    return {
      'i18n:extract': 'i18next-scanner --config i18next-scanner.config.js',
      'i18n:extract-auto': 'node scripts/extract-strings.js',
      'build:i18n': 'npm run i18n:extract && npm run build'
    };
  }

  // Generate TypeScript definitions for translations
  generateTypeDefinitions(strings) {
    if (!strings.length) return '';

    const interfaceContent = strings.map(stringData => {
      return `  '${stringData.key}': string;`;
    }).join('\n');

    return `// Auto-generated translation type definitions
export interface TranslationKeys {
${interfaceContent}
}

declare module 'react-i18next' {
  interface CustomTypeOptions {
    resources: {
      translation: TranslationKeys;
    };
  }
}
`;
  }

  // Generate main App.tsx modifications for i18n setup
  generateAppModifications() {
    return `// Add this import at the top of your App.tsx
import './i18n';

// Wrap your app content with Suspense for i18n loading
import { Suspense } from 'react';

function App() {
  return (
    <Suspense fallback={<div>Loading translations...</div>}>
      {/* Your existing app content */}
    </Suspense>
  );
}
`;
  }

  // Generate usage examples
  generateUsageExamples() {
    return `// Examples of how to use translations in your components

import { useTranslation } from '@/hooks/useTranslation';
// or import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      {/* Basic translation */}
      <h1>{t('title.welcome')}</h1>
      
      {/* Translation with interpolation */}
      <p>{t('message.hello', { name: 'John' })}</p>
      
      {/* Translation with pluralization */}
      <span>{t('message.item_count', { count: items.length })}</span>
      
      {/* Translation in attributes */}
      <input placeholder={t('form.placeholder.email')} />
      
      {/* Conditional translation */}
      <button>{loading ? t('button.loading') : t('button.submit')}</button>
    </div>
  );
}
`;
  }

  // Generate README for consolidated localization setup
  generateConsolidatedReadme(selectedLanguages = []) {
    const languageList = selectedLanguages.map(lang => `- ${lang.name} (${lang.code})`).join('\n');
    
    return `# Internationalization (i18n) Setup Guide - Consolidated Structure

This project uses a consolidated internationalization approach with a single \`translations.json\` file containing all languages.

## Quick Start

1. **Import the translation hook** in your components:
\`\`\`jsx
import { useTranslation } from '@/hooks/useTranslation';
\`\`\`

2. **Use translations** in your JSX:
\`\`\`jsx
function MyComponent() {
  const { t } = useTranslation();
  
  return <h1>{t('welcome.title')}</h1>;
}
\`\`\`

## Project Structure

- \`src/i18n/index.js\` - i18n configuration with consolidated transformation
- \`src/i18n/translations.json\` - **Single consolidated translation file**
- \`src/hooks/useTranslation.js\` - Custom translation hook
- \`src/components/LanguageSwitcher.jsx\` - Language selection component

## Consolidated Translation Structure

The \`translations.json\` file uses this structure:

\`\`\`json
{
  "button.analyze": {
    "en": "Analyze Repository",
    "es": "Analizar Repositorio",
    "fr": "Analyser le Référentiel"
  },
  "form.placeholder.github_url": {
    "en": "Enter GitHub repository URL",
    "es": "Ingrese la URL del repositorio de GitHub",
    "fr": "Entrez l'URL du référentiel GitHub"
  }
}
\`\`\`

## Benefits of Consolidated Structure

- **Single source of truth** for all translations
- **Easy gap identification** - immediately see missing translations
- **Better version control** - track all language changes in one file
- **Efficient batch processing** - translate all languages together
- **Reduced file management** - no need to manage multiple locale files

## Available Languages

${languageList}

## Adding New Languages

1. Add new language translations directly to \`src/i18n/translations.json\`:
   \`\`\`json
   {
     "your.key": {
       "en": "English text",
       "es": "Spanish text",
       "new_lang": "New language text"
     }
   }
   \`\`\`

2. The language will automatically be detected and available in the language switcher

## Translation Best Practices

- Use descriptive, hierarchical keys: \`user.profile.name\`
- Keep translations in sync across all languages within each key object
- Test your app in different languages regularly
- Use the LanguageSwitcher component for easy testing
- Check for missing translations by looking for incomplete key objects

## Commands

- Extract strings: \`npm run i18n:extract\`
- Build with i18n: \`npm run build:i18n\`

## Troubleshooting

### Missing Translations
Check the console for languages with missing translations. The \`transformConsolidatedTranslations\` function will log available languages and any issues.

### Adding New Strings
When adding new translatable strings to your code:
1. Use a descriptive key: \`t('component.action.description')\`
2. Add the key to \`translations.json\` with all language variants
3. Test with the language switcher

### Large Translation Files
The consolidated approach uses GPT-4o with 128k token context window, allowing for very large translation files without chunking.
`;
  }
}

export { I18nGenerator };
export default I18nGenerator;
