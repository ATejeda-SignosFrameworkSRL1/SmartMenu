
export const locales = ['es', 'en', 'zh', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'ru'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';
export const LOCALE_COOKIE = 'LOCALE';

export const localeNames: Record<Locale, string> = {
  es: 'Español', en: 'English', zh: '中文', fr: 'Français', de: 'Deutsch',
  pt: 'Português', it: 'Italiano', ja: '日本語', ko: '한국어', ru: 'Русский',
};

const RTL_LOCALES: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur']);
export function dirFor(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

const BCP47: Record<Locale, string> = {
  es: 'es-DO', en: 'en-US', zh: 'zh-CN', fr: 'fr-FR', de: 'de-DE',
  pt: 'pt-BR', it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', ru: 'ru-RU',
};
export function dateLocale(locale: string): string {
  return BCP47[locale as Locale] ?? 'es-DO';
}
