// i18n/request.ts — Configuración por-request de next-intl (modo sin ruteo por URL).
// Cookie LOCALE → whitelist → carga sólo el idioma activo → deep-merge sobre es (fallback).
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';
import esMessages from '../messages/es.json';

type Messages = typeof esMessages;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : (override as T);
  }
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    out[key] = deepMerge((base as Record<string, unknown>)[key], override[key]);
  }
  return out as T;
}

async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === defaultLocale) return esMessages;
  try {
    const mod = (await import(`../messages/${locale}.json`)).default as Partial<Messages>;
    return deepMerge(esMessages, mod);
  } catch {
    return esMessages;
  }
}

export default getRequestConfig(async () => {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const messages = await loadMessages(locale);

  return {
    locale,
    messages,
    onError() {},
    getMessageFallback({ key }) {
      return key;
    },
  };
});
