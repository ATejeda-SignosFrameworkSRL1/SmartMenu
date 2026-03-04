'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir inmediatamente al login
    router.replace('/login');
  }, [router]);

  return null;
}
