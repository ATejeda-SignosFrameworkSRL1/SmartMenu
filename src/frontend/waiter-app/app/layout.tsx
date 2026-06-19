import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { InactivityGuard } from "./components/InactivityGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SmartMenu Mesero - App para Meseros",
  description: "Aplicación para meseros de SmartMenu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {children}
        {/* Sprint 4.1 — auto-logout 90s para sesiones PIN (no afecta login normal) */}
        <InactivityGuard timeoutSeconds={90} warningSeconds={15} />
      </body>
    </html>
  );
}
