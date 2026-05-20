'use client';

import { LoginScreen } from '@/components/LoginScreen';

export default function Page() {
  return (
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
  );
}
