import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { InactivityGuard } from "./components/InactivityGuard";
import { dirFor } from "@/i18n/config";

// Inter como variable CSS: el font-stack de Tailwind antepone Inter y cae a CJK.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "SmartMenu Mesero - App para Meseros",
  description: "Aplicación para meseros de SmartMenu",
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
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          {/* Sprint 4.1 — auto-logout 90s para sesiones PIN (no afecta login normal) */}
          <InactivityGuard timeoutSeconds={90} warningSeconds={15} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
