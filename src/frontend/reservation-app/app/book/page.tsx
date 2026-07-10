import { permanentRedirect } from 'next/navigation';

// DEDUP-BOOK.1 — /book duplicaba ~400 lineas del wizard real (BookingEngineWarm,
// montado en / y /area-completa) y ya habia divergido (version degradada sin zonas
// ni modo area). Nada en el repo enlaza a /book, pero es una ruta PUBLICA que pudo
// imprimirse en algun material: se conserva como redirect permanente (308) al
// wizard real en vez de borrarla.
export default function BookPage() {
  permanentRedirect('/');
}
