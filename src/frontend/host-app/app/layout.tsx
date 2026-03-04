import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartMenu - Host App',
  description: 'Aplicación de recepcionista para SmartMenu',
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
