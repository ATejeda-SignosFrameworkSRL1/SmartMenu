// i18n/request.ts — Configuración por-request de next-intl (modo sin ruteo por URL).
//
// 1. Lee la cookie LOCALE y la valida contra la whitelist (seguridad).
// 2. Carga SOLO el catálogo del idioma activo (chunk async) → costo O(1) en
//    cantidad de idiomas; el bundle no crece por agregar idiomas.
// 3. Hace deep-merge del catálogo activo SOBRE el español → cualquier clave sin
//    traducir cae a español. Nunca se muestra una clave cruda ni revienta el render.
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';
import esMessages from '../messages/es.json';

type Messages = typeof esMessages;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Mezcla profunda: base (es) + override (idioma activo). El override gana cuando existe.
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
    // Si el JSON del idioma no existe/falla, caemos al español completo.
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
    // Ya hicimos fallback a es en el merge; silenciamos el resto para no ensuciar consola.
    onError() {},
    getMessageFallback({ key }) {
      return key;
    },
  };
});
