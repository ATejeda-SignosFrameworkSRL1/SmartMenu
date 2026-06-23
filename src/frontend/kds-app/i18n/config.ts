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

// Listo para RTL: hoy ningún idioma de la lista es RTL.
const RTL_LOCALES: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur']);

export function dirFor(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

// Mapa locale → etiqueta BCP-47 para formateo de fechas/horas (toLocaleTimeString, etc.).
const BCP47: Record<Locale, string> = {
  es: 'es-DO', en: 'en-US', zh: 'zh-CN', fr: 'fr-FR', de: 'de-DE',
  pt: 'pt-BR', it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', ru: 'ru-RU',
};

export function dateLocale(locale: string): string {
  return BCP47[locale as Locale] ?? 'es-DO';
}
