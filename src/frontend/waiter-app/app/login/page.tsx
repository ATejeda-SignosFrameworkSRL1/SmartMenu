'use client';

import { LoginScreen } from '@/components/LoginScreen';
import Link from 'next/link';
import { Lock } from 'lucide-react';

export default function Page() {
  return (
    <div className="relative">
      <LoginScreen
        appKey="waiter"
        appTitle="App para Meseros"
        acceptedRoles={['Waiter']}
        accent="from-emerald-600 to-teal-600"
        quickUsers={[
          { email: 'waiter@smartmenu.com',  password: 'Waiter123!', label: 'María (Waiter)', emoji: '👔',   hint: 'OK' },
          { email: 'waiter2@smartmenu.com', password: 'Waiter2!',   label: 'Pedro (Waiter)', emoji: '👔',   hint: 'OK' },
          { email: 'admin@smartmenu.com',   password: 'Admin123!',  label: 'Admin',          emoji: '👨‍💼', hint: 'OK' },
          { email: 'cashier@smartmenu.com', password: 'Cash123!',   label: 'Cajero',         emoji: '💰' },
        ]}
      />
      {/* SPRINT 3: link a login por PIN — modo device compartido */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none">
        <Link
          href="/login/pin"
          className="pointer-events-auto inline-flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-emerald-200 rounded-full shadow-lg hover:border-emerald-400 hover:shadow-xl transition-all text-sm font-semibold text-emerald-700"
        >
          <Lock className="w-4 h-4" />
          Acceso rápido con PIN
        </Link>
      </div>
    </div>
  );
}
