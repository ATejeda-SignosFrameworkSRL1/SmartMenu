'use client';

import { LoginScreen } from '@/components/LoginScreen';

export default function Page() {
  return (
    <LoginScreen
      appKey="reservation"
      appTitle="Gestión de Reservaciones"
      acceptedRoles={['Host', 'Hostess', 'Manager']}
      accent="from-rose-600 to-fuchsia-600"
      quickUsers={[
        { email: 'host@smartmenu.com',   password: 'Host123!',   label: 'Host (Laura)', emoji: '🚪',   hint: 'OK' },
        { email: 'admin@smartmenu.com',  password: 'Admin123!',  label: 'Admin',        emoji: '👨‍💼', hint: 'OK' },
        { email: 'chef@smartmenu.com',   password: 'Chef123!',   label: 'Chef',         emoji: '👨‍🍳' },
        { email: 'waiter@smartmenu.com', password: 'Waiter123!', label: 'Mesero',       emoji: '👔' },
      ]}
    />
  );
}
