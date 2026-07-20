'use client';

import { LoginScreen } from '@/components/LoginScreen';

export default function Page() {
  return (
    <LoginScreen
      appKey="delivery"
      appTitle="Panel de Repartidor"
      acceptedRoles={['Delivery']}
      accent="from-teal-600 to-emerald-600"
      quickUsers={[
        { email: 'delivery@smartmenu.com', password: 'Delivery123!', label: 'Repartidor', emoji: '🛵', hint: 'OK' },
        { email: 'admin@smartmenu.com',    password: 'Admin123!',    label: 'Admin',      emoji: '👨‍💼', hint: 'OK' },
        { email: 'waiter@smartmenu.com',   password: 'Waiter123!',   label: 'Mesero',     emoji: '👔' },
        { email: 'chef@smartmenu.com',     password: 'Chef123!',     label: 'Chef',       emoji: '👨‍🍳' },
      ]}
    />
  );
}
