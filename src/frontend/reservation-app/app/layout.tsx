import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SmartMenu - Reservaciones',
  description: 'Reserva tu mesa y disfruta de una experiencia gastronómica única. Cocina de autor en un ambiente exclusivo.',
  keywords: ['restaurante', 'reservaciones', 'cocina gourmet', 'Santo Domingo'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-body bg-warm-50 text-warm-900 antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#2C2520',
              color: '#FAF7F0',
              borderRadius: '12px',
            },
            success: { iconTheme: { primary: '#DAA520', secondary: '#FAF7F0' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#FAF7F0' } },
          }}
        />
      </body>
    </html>
  );
}
