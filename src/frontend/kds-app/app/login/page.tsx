'use client';

import { LoginScreen } from '@/components/LoginScreen';

export default function Page() {
  return (
    <LoginScreen
      appKey="kds"
      appTitle="Kitchen Display System"
      acceptedRoles={['Chef', 'KitchenStaff', 'Bartender']}
      accent="from-orange-600 to-amber-600"
      quickUsers={[
        { email: 'chef@smartmenu.com',      password: 'Chef123!',   label: 'Chef',      emoji: '👨‍🍳', hint: 'OK' },
        { email: 'bartender@smartmenu.com', password: 'Bar123!',    label: 'Bartender', emoji: '🍹',   hint: 'OK' },
        { email: 'admin@smartmenu.com',     password: 'Admin123!',  label: 'Admin',     emoji: '👨‍💼', hint: 'OK' },
        { email: 'waiter@smartmenu.com',    password: 'Waiter123!', label: 'Mesero',    emoji: '👔' },
      ]}
    />
  );
}
