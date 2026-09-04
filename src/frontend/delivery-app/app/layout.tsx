import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { dirFor } from "@/i18n/config";

import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: "SmartMenu Delivery",
  description: "Panel de repartidor para SmartMenu",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={dirFor(locale)} className={inter.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>
              <ServiceWorkerRegister />
      </body>
    </html>
  );
}
