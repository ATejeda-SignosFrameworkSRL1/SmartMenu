import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartMenu - Caja',
  description: 'Aplicación de cajero para SmartMenu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
