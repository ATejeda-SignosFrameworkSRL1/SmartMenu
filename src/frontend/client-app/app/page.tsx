'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function Home() {
  const router = useRouter();
  const t = useTranslations('common');

  useEffect(() => {

    router.replace('/table');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-700">{t('loading')}</p>
      </div>
    </div>
  );
}
