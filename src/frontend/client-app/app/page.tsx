'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // El customer-app es anónimo (sin login). El flujo real entra por
    // /table/<qrCode> al escanear un QR. La raíz "/" lleva al listado de
    // mesas con QR codes — útil para staff/dev y para que el cliente
    // que abrió la URL sin escanear igual pueda elegir su mesa.
    router.replace('/table');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-700">Cargando…</p>
      </div>
    </div>
  );
}
