
import i18n from 'i18next';
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
console.log('📝 Translation keys per language:', 
  Object.keys(resources).reduce((acc, lang) => {
    acc[lang] = Object.keys(resources[lang].translation).length;
    return acc;
  }, {})
);

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
