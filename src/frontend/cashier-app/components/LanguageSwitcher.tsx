'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';
import { locales, localeNames, type Locale } from '@/i18n/config';
import { setLocale } from '@/i18n/actions';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const active = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <label className={`inline-flex items-center gap-1.5 ${className}`}>
      <Globe className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
      <span className="sr-only">Idioma / Language</span>
      <select
        value={active}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Locale;
          startTransition(() => {
            void setLocale(next);
          });
        }}
        aria-label="Idioma / Language"
        className="cursor-pointer rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeNames[loc]}
          </option>
        ))}
      </select>
    </label>
  );
}
