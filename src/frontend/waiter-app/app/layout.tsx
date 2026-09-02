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
        {/* SMARTWATCH — modo reloj: activacion + ESCALA ADAPTATIVA.
            Inline y antes del render para que no haya parpadeo sin escalar.

            Por que escala adaptativa y no un tamaño fijo: el mismo panel fisico de
            2.4" y 640x480 reales puede presentarse como 640x480, 427x320 o 320x240
            px CSS segun el devicePixelRatio que declare Android. Un font-size fijo
            acierta en uno y falla en los otros dos. En su lugar fijamos el ancho de
            DISEÑO y derivamos la raiz: Tailwind dimensiona todo en rem, asi que la
            interfaz se comporta igual sea cual sea el viewport real.

            ?watch=1 lo activa y queda guardado (?watch=0 lo quita).
            ?ws=<px> ajusta el ancho de diseño y tambien queda guardado: bajarlo
            agranda todo (util en una pantalla de 49 mm), subirlo mete mas contenido. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var d=document.documentElement, LS=null;
              try{ LS=window.localStorage; }catch(e){}
              var p=new URLSearchParams(location.search);
              var q=p.get('watch'), ws=p.get('ws');
              if(LS){
                if(q==='1'){LS.setItem('waiter_watch_mode','1');}
                else if(q==='0'){LS.removeItem('waiter_watch_mode');}
                if(ws&&/^[0-9]{3,4}$/.test(ws)){LS.setItem('waiter_watch_design',ws);}
              }
              var forced = LS && LS.getItem('waiter_watch_mode')==='1';
              var w=window.innerWidth||0, h=window.innerHeight||0;
              var sw=(window.screen&&window.screen.width)||0;
              var sh=(window.screen&&window.screen.height)||0;
              // Deteccion automatica, deliberadamente conservadora para NO tocar
              // telefonos: uno vertical mide ~375x812 y horizontal ~812x375.
              //  (a) pantalla chica en AMBAS dimensiones -> reloj con DPR 1.5 o 2
              //  (b) panel de 640x480 con DPR 1: se distingue de un telefono en
              //      horizontal porque screen.width no pasa de 640 (un iPhone SE
              //      acostado da 667, un iPhone normal 812).
              var auto = (w>0&&h>0&&w<=520&&h<=560) ||
                         (sw>0&&sw<=640&&sh>0&&sh<=480&&h>0&&h<=520);
              if(!(forced||auto)) return;
              d.classList.add('watch-mode');
              var DESIGN=360;
              var saved = LS && LS.getItem('waiter_watch_design');
              if(saved&&/^[0-9]{3,4}$/.test(saved)){DESIGN=parseInt(saved,10);}
              function scale(){
                var vw=window.innerWidth||DESIGN;
                var fs=16*(vw/DESIGN);
                if(fs<8)fs=8; if(fs>40)fs=40;   // topes de cordura
                d.style.fontSize=fs.toFixed(2)+'px';
                d.setAttribute('data-watch-vw',vw+'x'+(window.innerHeight||0));
              }
              scale();
              window.addEventListener('resize',scale);
              window.addEventListener('orientationchange',function(){setTimeout(scale,250);});
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
