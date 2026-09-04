import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { dirFor } from '@/i18n/config';

import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: 'SmartMenu - Caja',
  description: 'Aplicación de cajero para SmartMenu',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>
              <ServiceWorkerRegister />
      </body>
    </html>
  );
}
