// i18n/config.ts — Única fuente de verdad de los idiomas soportados.
// Modo "sin ruteo por URL" de next-intl: el idioma vive en una cookie, no en la ruta.

export const locales = ['es', 'en', 'zh', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'ru'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

export const LOCALE_COOKIE = 'LOCALE';

// Nombres nativos para el selector de idioma.
export const localeNames: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  zh: '中文',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
};

// Listo para RTL: hoy ningún idioma de la lista es RTL, pero si se agrega
// ár/he/fa/ur el layout ya conmuta `dir` automáticamente.
const RTL_LOCALES: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur']);

export function dirFor(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

// Validación de whitelist (se usa en cliente y servidor antes de leer/escribir).
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
