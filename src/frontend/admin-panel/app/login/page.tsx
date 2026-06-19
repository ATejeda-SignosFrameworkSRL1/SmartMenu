'use client';

import { LoginScreen } from '@/components/LoginScreen';

export default function Page() {
  return (
    <LoginScreen
      appKey="admin"
      appTitle="Panel de Administración"
      acceptedRoles={['Admin', 'Manager']}
      accent="from-blue-600 to-indigo-600"
      quickUsers={[
        { email: 'admin@smartmenu.com',   password: 'Admin123!',   label: 'Admin',   emoji: '👨‍💼', hint: 'OK' },
        { email: 'chef@smartmenu.com',    password: 'Chef123!',    label: 'Chef',    emoji: '👨‍🍳' },
        { email: 'waiter@smartmenu.com',  password: 'Waiter123!',  label: 'Mesero',  emoji: '👔' },
        { email: 'cashier@smartmenu.com', password: 'Cash123!',    label: 'Cajero',  emoji: '💰' },
      ]}
    />
  );
}
