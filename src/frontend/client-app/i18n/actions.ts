'use server';
// i18n/actions.ts — Server Action para fijar el idioma vía cookie (sin cambiar la URL).
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isLocale, LOCALE_COOKIE } from './config';

export async function setLocale(next: string): Promise<void> {
  // Seguridad: sólo aceptamos códigos dentro de la whitelist.
  if (!isLocale(next)) return;

  cookies().set(LOCALE_COOKIE, next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 año
    sameSite: 'lax',
    httpOnly: false, // sólo es el código de idioma; no es dato sensible
    secure: process.env.NODE_ENV === 'production',
  });

  // Re-renderiza todo el árbol (RSC) con el idioma nuevo, sin recarga dura.
  revalidatePath('/', 'layout');
}
