'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, UtensilsCrossed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const BookingEngineWarm = dynamic(() => import('@/components/BookingEngineWarm'), { ssr: false });

export default function AreaCompletaPage() {
  const t = useTranslations('areaCompleta');

  return (
    <main className="min-h-screen bg-warm-950">

      <header className="border-b border-warm-800">
        <div className="container-narrow flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <UtensilsCrossed className="h-7 w-7 text-primary-light" />
            <span className="font-display text-2xl font-bold text-white">SmartMenu</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-warm-300 transition-colors hover:text-primary-light"
            >
              <ArrowLeft className="h-4 w-4" /> {t('back')}
            </Link>
          </div>
        </div>
      </header>

      <section className="section-padding">
        <div className="container-narrow max-w-2xl">
          <div className="mb-8 text-center sm:mb-10">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary-light">
              {t('privateEvent')}
            </span>
            <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
              {t('title')}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-warm-400">
              {t('subtitle')}
            </p>
          </div>
          <BookingEngineWarm forceMode="area" />
        </div>
      </section>
    </main>
  );
}
