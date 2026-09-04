'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isLocale, LOCALE_COOKIE } from './config';

export async function setLocale(next: string): Promise<void> {

  if (!isLocale(next)) return;

  cookies().set(LOCALE_COOKIE, next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });

  revalidatePath('/', 'layout');
}
