class I18nGenerator {
  constructor(framework = 'React') {
    this.framework = framework;
  }

  // Generate i18n configuration file
  generateI18nConfig() {
    if (this.framework === 'React') {
      return `import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from './locales/en.json';

const resources = {
  en: {
    translation: enTranslations,
  },
  // Add other languages here as you create them
  // es: { translation: esTranslations },
  // fr: { translation: frTranslations },
};

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
    
    // Add other framework configurations as needed
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
  generateEmptyTranslationFile(strings) {
    const translations = {};
    
    strings.forEach(stringData => {
      const keys = stringData.key.split('.');
      let current = translations;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = '';
    });
    
    return JSON.stringify(translations, null, 2);
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

  // Generate README for localization setup
  generateReadme() {
    return `# Internationalization (i18n) Setup Guide

This project has been configured with internationalization support using react-i18next.

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

- \`src/i18n/index.js\` - i18n configuration
- \`src/i18n/locales/\` - Translation files
- \`src/hooks/useTranslation.js\` - Custom translation hook
- \`src/components/LanguageSwitcher.jsx\` - Language selection component

## Adding New Languages

1. Create a new translation file: \`src/i18n/locales/{lang}.json\`
2. Add the language to the resources in \`src/i18n/index.js\`
3. Update the language list in \`LanguageSwitcher.jsx\`

## Translation Best Practices

- Use descriptive, hierarchical keys: \`user.profile.name\`
- Keep translations in sync across all language files
- Test your app in different languages regularly
- Use the LanguageSwitcher component for easy testing

## Available Languages

- English (en) - Default
- Spanish (es)
- Arabic (ar)  
- Chinese (zh)

## Commands

- Extract strings: \`npm run i18n:extract\`
- Build with i18n: \`npm run build:i18n\`
`;
  }
}

export { I18nGenerator };
export default I18nGenerator;