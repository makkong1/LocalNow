const i18next = require('i18next').default ?? require('i18next');
const { initReactI18next } = require('react-i18next');
const ko = require('./src/i18n/ko.json');

if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    lng: 'ko',
    fallbackLng: 'ko',
    resources: { ko: { translation: ko } },
    interpolation: { escapeValue: false },
    initImmediate: false,
  });
}

// Materialise expo/winter lazy globals before any test accesses them.
// Expo installs these as lazy getter+setter pairs. Assigning to the property
// calls the setter, replacing the getter with a real value and preventing the
// "import outside scope" error that fires when the getter tries to require().

globalThis.__ExpoImportMetaRegistry = { url: '' };

// Provide structuredClone (expo lazily polyfills via @ungap/structured-clone)
globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
