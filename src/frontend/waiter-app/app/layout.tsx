import type { Metadata, Viewport } from "next";
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

// SMARTWATCH — viewport explícito. Sin esto quedaba el default de Next y no había control
// de zoom ni del área segura: en un reloj (pantalla ~400px, a veces con bisel redondo) el
// contenido se recortaba en los bordes. `viewport-fit: cover` respeta las safe-areas y
// maximumScale 5 deja al mesero hacer zoom si necesita leer algo puntual.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#16a34a",
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
      <head>
        {/* SMARTWATCH — activador MANUAL del modo reloj, por si la deteccion por media
            query no aplica en el dispositivo. Se activa una vez con ?watch=1 y queda
            guardado (?watch=0 lo desactiva). Va inline y antes del render para que no
            haya parpadeo de la interfaz sin escalar. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var p=new URLSearchParams(location.search),q=p.get('watch');
              if(q==='1'){localStorage.setItem('waiter_watch_mode','1');}
              else if(q==='0'){localStorage.removeItem('waiter_watch_mode');}
              if(localStorage.getItem('waiter_watch_mode')==='1'){
                document.documentElement.classList.add('watch-mode');
              }
            }catch(e){}})();`,
          }}
        />
      </head>
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
