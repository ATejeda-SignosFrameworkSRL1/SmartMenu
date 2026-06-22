'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function SeguimientoIndex() {
  const router = useRouter();
  const t = useTranslations('tracking');
  const [code, setCode] = useState('');

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (c) router.push(`/seguimiento/${encodeURIComponent(c)}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> {t('back')}
        </Link>
        <form onSubmit={go} className="rounded-2xl bg-white shadow-xl border border-slate-100 px-6 py-8">
          <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('help')}</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('codePh')}
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button type="submit" className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700">
            <Search className="h-4 w-4" /> {t('seeStatus')}
          </button>
        </form>
      </div>
    </main>
  );
}
