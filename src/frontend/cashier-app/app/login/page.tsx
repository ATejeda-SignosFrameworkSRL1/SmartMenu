'use client';

import { LoginScreen } from '@/components/LoginScreen';

export default function Page() {
  return (
    <LoginScreen
      appKey="cashier"
      appTitle="Caja"
      acceptedRoles={['Cashier']}
      accent="from-amber-600 to-yellow-600"
      quickUsers={[
        { email: 'cashier@smartmenu.com', password: 'Cash123!',   label: 'Cajera (Ana)', emoji: '💰',   hint: 'OK' },
        { email: 'admin@smartmenu.com',   password: 'Admin123!',  label: 'Admin',        emoji: '👨‍💼', hint: 'OK' },
        { email: 'chef@smartmenu.com',    password: 'Chef123!',   label: 'Chef',         emoji: '👨‍🍳' },
        { email: 'waiter@smartmenu.com',  password: 'Waiter123!', label: 'Mesero',       emoji: '👔' },
      ]}
    />
  );
}
