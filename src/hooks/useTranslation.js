import { useTranslation as useI18nTranslation } from 'react-i18next';

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