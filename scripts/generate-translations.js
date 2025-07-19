import { I18nGenerator } from '../src/utils/i18nGenerator.js';
import fs from 'fs';
import path from 'path';

const generator = new I18nGenerator();

const languages = ['es', 'fr', 'de']; // Add other languages as needed

const strings = JSON.parse(fs.readFileSync(path.resolve('src/i18n/locales/en.json'), 'utf-8'));

const stringData = Object.keys(strings).map(key => ({ key, text: strings[key] }));

languages.forEach(async (lang) => {
    const generatedFile = await generator.generateEmptyTranslationFile(stringData, lang);
    fs.writeFileSync(path.resolve(`src/i18n/locales/${lang}.json`), generatedFile);
    console.log(`Generated translation file for ${lang}`);
});
