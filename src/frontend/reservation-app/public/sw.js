/* SmartMenu Mesero — service worker minimo.
 *
 * PARA QUE: hacer la app instalable (icono propio y display standalone, que en un
 * reloj de 2.4" recupera el alto de la barra de direcciones) y que un bache de
 * Wi-Fi no deje una pantalla en blanco.
 *
 * QUE **NO** HACE, a proposito:
 *  - No cachea documentos HTML. El idioma se resuelve en el servidor leyendo la
 *    cookie LOCALE (i18n/config.ts), asi que un HTML cacheado congelaria el
 *    idioma del mesero hasta que caducara la cache.
 *  - No toca /api, /hubs ni /uploads: son datos vivos y la conexion SignalR.
 *    Interceptarlos solo podria servir informacion de mesas obsoleta, que en
 *    este dominio es peor que un error.
 *  - No hace push. Las notificaciones actuales llegan por SignalR mientras la
 *    app esta abierta (lib/useWaiterNotifications.ts). Los avisos con la app
 *    cerrada necesitan Web Push, que es backend + VAPID y va aparte.
 *
 * Lo unico que cachea es /_next/static/*, cuyos nombres llevan hash de
 * contenido: son inmutables, asi que servirlos desde cache no puede quedar
 * obsoleto (un cambio produce otra URL). Ademas aqui aporta de verdad, porque
 * next.config.mjs manda `Cache-Control: no-store` en todo y deja inutil la
 * cache HTTP del navegador.
 */

const CACHE = 'sm-waiter-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Datos vivos: que pasen sin intervencion.
  if (
    url.pathname.indexOf('/api/') === 0 ||
    url.pathname.indexOf('/hubs/') === 0 ||
    url.pathname.indexOf('/uploads/') === 0
  ) {
    return;
  }

  // Assets con hash en el nombre -> cache primero (inmutables).
  if (url.pathname.indexOf('/_next/static/') === 0) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
    return;
  }

  // Navegaciones -> SIEMPRE red (el idioma depende de la cookie); si no hay red,
  // se muestra la pagina offline en vez de la de error del navegador.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
