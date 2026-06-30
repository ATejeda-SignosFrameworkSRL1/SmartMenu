// lib/countryCodes.ts
// Prefijos telefónicos internacionales para el input de teléfono de reservas.
// El nombre va en español (idioma base del catálogo); la bandera se deriva del
// código ISO-3166-1 alpha-2 (regional indicators), así no hay que hardcodear emojis.

export interface CountryCode {
  /** ISO-3166-1 alpha-2, ej. "DO" */
  iso: string;
  /** Nombre en español */
  name: string;
  /** Prefijo internacional de marcación, ej. "+1" */
  dial: string;
}

/** País por defecto del input (República Dominicana). */
export const DEFAULT_COUNTRY_ISO = 'DO';

// Los más frecuentes para RD primero; el resto, alfabético por nombre.
export const COUNTRIES: CountryCode[] = [
  { iso: 'DO', name: 'República Dominicana', dial: '+1' },
  { iso: 'US', name: 'Estados Unidos', dial: '+1' },
  { iso: 'PR', name: 'Puerto Rico', dial: '+1' },
  { iso: 'ES', name: 'España', dial: '+34' },
  { iso: 'MX', name: 'México', dial: '+52' },
  { iso: 'HT', name: 'Haití', dial: '+509' },
  { iso: 'CO', name: 'Colombia', dial: '+57' },
  { iso: 'VE', name: 'Venezuela', dial: '+58' },
  { iso: 'CU', name: 'Cuba', dial: '+53' },
  { iso: 'CA', name: 'Canadá', dial: '+1' },
  // ── resto, alfabético ──
  { iso: 'DE', name: 'Alemania', dial: '+49' },
  { iso: 'AR', name: 'Argentina', dial: '+54' },
  { iso: 'AW', name: 'Aruba', dial: '+297' },
  { iso: 'BO', name: 'Bolivia', dial: '+591' },
  { iso: 'BR', name: 'Brasil', dial: '+55' },
  { iso: 'CL', name: 'Chile', dial: '+56' },
  { iso: 'CN', name: 'China', dial: '+86' },
  { iso: 'KR', name: 'Corea del Sur', dial: '+82' },
  { iso: 'CR', name: 'Costa Rica', dial: '+506' },
  { iso: 'CW', name: 'Curazao', dial: '+599' },
  { iso: 'EC', name: 'Ecuador', dial: '+593' },
  { iso: 'SV', name: 'El Salvador', dial: '+503' },
  { iso: 'FR', name: 'Francia', dial: '+33' },
  { iso: 'GT', name: 'Guatemala', dial: '+502' },
  { iso: 'HN', name: 'Honduras', dial: '+504' },
  { iso: 'IT', name: 'Italia', dial: '+39' },
  { iso: 'JM', name: 'Jamaica', dial: '+1' },
  { iso: 'JP', name: 'Japón', dial: '+81' },
  { iso: 'NI', name: 'Nicaragua', dial: '+505' },
  { iso: 'NL', name: 'Países Bajos', dial: '+31' },
  { iso: 'PA', name: 'Panamá', dial: '+507' },
  { iso: 'PY', name: 'Paraguay', dial: '+595' },
  { iso: 'PE', name: 'Perú', dial: '+51' },
  { iso: 'PT', name: 'Portugal', dial: '+351' },
  { iso: 'GB', name: 'Reino Unido', dial: '+44' },
  { iso: 'RU', name: 'Rusia', dial: '+7' },
  { iso: 'CH', name: 'Suiza', dial: '+41' },
  { iso: 'TT', name: 'Trinidad y Tobago', dial: '+1' },
  { iso: 'UY', name: 'Uruguay', dial: '+598' },
];

/** Emoji de bandera a partir del ISO-3166-1 alpha-2. */
export function flagEmoji(iso: string): string {
  const cc = iso.toUpperCase();
  if (cc.length !== 2) return '';
  const A = 0x1f1e6; // 🇦
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

/** País por ISO; cae al primero (RD) si no se encuentra. */
export function countryByIso(iso: string): CountryCode {
  return COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0];
}

export function dialForIso(iso: string): string {
  return countryByIso(iso).dial;
}

/**
 * Compone el teléfono final con prefijo internacional, ej. ("DO", "809 555 0000")
 * → "+1 809 555 0000". Devuelve "" si el número local viene vacío.
 */
export function composePhone(iso: string, local: string): string {
  const num = local.trim();
  if (!num) return '';
  return `${dialForIso(iso)} ${num}`;
}
