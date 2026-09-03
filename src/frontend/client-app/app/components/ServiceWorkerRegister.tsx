'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker (public/sw.js) para que la app sea instalable y
 * sobreviva un bache de Wi-Fi. Aditivo: si algo falla, la app funciona igual.
 *
 * Requisito que conviene tener presente: el navegador NO registra un service
 * worker en una pagina con error de certificado. En el stack QA el cert lo
 * firma la CA local de Caddy, asi que en un dispositivo que solo "continuo"
 * pasando el aviso esto no se registra; hay que instalar la CA. Por eso el
 * fallo se traga en silencio en vez de molestar al mesero.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // isSecureContext descarta de entrada el caso de HTTP plano.
    if (typeof window !== 'undefined' && !window.isSecureContext) return;

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* cert no confiable, modo incognito, etc.: la app sigue funcionando */
      });
    };

    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
