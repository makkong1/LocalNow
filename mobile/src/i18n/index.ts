import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import ko from './ko.json';
import en from './en.json';
import zh from './zh.json';
import ja from './ja.json';

const LANG_KEY = 'app_language';

export const SUPPORTED_LANGUAGES = ['ko', 'en', 'zh', 'ja'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** 언어 선택 UI 용 표시 이름 (각 언어 자체 표기) */
export const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  ja: '日本語',
};

export async function initI18n(): Promise<void> {
  const saved = await SecureStore.getItemAsync(LANG_KEY);
  const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'ko';
  const detected =
    SUPPORTED_LANGUAGES.find((l) => deviceLocale.startsWith(l)) ?? 'ko';
  const lng: SupportedLanguage = (saved as SupportedLanguage) ?? detected;

  await i18n.use(initReactI18next).init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
      zh: { translation: zh },
      ja: { translation: ja },
    },
    lng,
    fallbackLng: 'ko',
    interpolation: { escapeValue: false },
  });
}

export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await SecureStore.setItemAsync(LANG_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
