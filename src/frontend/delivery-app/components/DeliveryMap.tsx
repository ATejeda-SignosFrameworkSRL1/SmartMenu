'use client';

/**
 * DeliveryMap — mapa de seguimiento en vivo (Google Maps) para la app del repartidor.
 *
 * "Key-ready": si NEXT_PUBLIC_GOOGLE_MAPS_API_KEY está vacía, renderiza un
 * placeholder y NUNCA carga el script ni rompe la app.
 *
 * Puntos que dibuja:
 *   A = restaurante  (invoice.restaurantLat/Lng; fallback Santo Domingo, RD)
 *   B = casa del cliente (geocodifica invoice.deliveryAddress en el navegador)
 *   🛵 = repartidor (livePosition del dispositivo, o invoice.driverLat/Lng reportada)
 *
 * La posición en vivo (watchPosition) y el reporte al backend viven en el
 * componente padre (app/page.tsx); aquí solo se dibuja lo que llega por props.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { GoogleMap, DirectionsRenderer, Marker, useLoadScript } from '@react-google-maps/api';
import { useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';

// Fallback razonable si el restaurante no tiene coordenadas: Santo Domingo, RD.
const FALLBACK_A: google.maps.LatLngLiteral = { lat: 18.4861, lng: -69.9312 };

const CONTAINER_STYLE: CSSProperties = {
  width: '100%',
  height: '320px',
  borderRadius: '0.5rem',
};

// Estilo oscuro compacto para combinar con el tema slate/teal de la app.
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export interface DeliveryMapInvoice {
  id: number;
  deliveryAddress?: string | null;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
}

interface DeliveryMapProps {
  invoice: DeliveryMapInvoice;
  /** Posición en vivo del dispositivo (tiene prioridad sobre driverLat/Lng). */
  livePosition?: google.maps.LatLngLiteral | null;
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Card de placeholder — se usa sin key, o si el script falla al cargar. */
function MapPlaceholder({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-600 bg-slate-900/60 p-6 text-center"
      style={{ minHeight: '160px' }}
    >
      <MapPin className="h-10 w-10 text-slate-500" aria-hidden />
      <p className="max-w-md text-sm text-slate-400">{message}</p>
    </div>
  );
}

/**
 * Entrada pública. Lee la env pública ANTES de tocar ningún hook de mapa, para
 * poder devolver el placeholder sin cargar el script de Google.
 * (Los hooks de mapa viven en <MapInner>, que solo se monta cuando hay key.)
 */
export default function DeliveryMap({ invoice, livePosition }: DeliveryMapProps) {
  const t = useTranslations('delivery');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return <MapPlaceholder message={t('mapPlaceholder')} />;
  }

  return <MapInner apiKey={apiKey} invoice={invoice} livePosition={livePosition} />;
}

function MapInner({
  apiKey,
  invoice,
  livePosition,
}: DeliveryMapProps & { apiKey: string }) {
  const t = useTranslations('delivery');
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: apiKey });

  const [pointB, setPointB] = useState<google.maps.LatLngLiteral | null>(null);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const hasRestaurant = isNum(invoice.restaurantLat) && isNum(invoice.restaurantLng);
  const pointA = useMemo<google.maps.LatLngLiteral>(
    () =>
      hasRestaurant
        ? { lat: invoice.restaurantLat as number, lng: invoice.restaurantLng as number }
        : FALLBACK_A,
    [hasRestaurant, invoice.restaurantLat, invoice.restaurantLng],
  );

  // Posición del repartidor: en vivo (dispositivo) o la última reportada.
  const driverPos = useMemo<google.maps.LatLngLiteral | null>(() => {
    if (livePosition && isNum(livePosition.lat) && isNum(livePosition.lng)) return livePosition;
    if (isNum(invoice.driverLat) && isNum(invoice.driverLng)) {
      return { lat: invoice.driverLat as number, lng: invoice.driverLng as number };
    }
    return null;
  }, [livePosition, invoice.driverLat, invoice.driverLng]);

  // Geocodifica la dirección del cliente (PUNTO B) una vez cargado el script.
  useEffect(() => {
    if (!isLoaded) return;
    const address = invoice.deliveryAddress?.trim();
    if (!address) {
      setGeocodeFailed(true);
      return;
    }
    let cancelled = false;
    setGeocodeFailed(false);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (cancelled) return;
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        setPointB({ lat: loc.lat(), lng: loc.lng() });
      } else {
        setGeocodeFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, invoice.deliveryAddress]);

  // Ruta A -> B. Si falla, dejamos directions en null y mostramos solo marcadores.
  useEffect(() => {
    if (!isLoaded || !pointB) return;
    let cancelled = false;
    const service = new google.maps.DirectionsService();
    service.route(
      { origin: pointA, destination: pointB, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (cancelled) return;
        setDirections(status === 'OK' && result ? result : null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isLoaded, pointA, pointB]);

  // Encuadra A + B (+ repartidor si ya se conoce) UNA vez que B se resuelve.
  // No re-encuadramos en cada tick del GPS para no marear con zooms constantes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(pointA);
    if (pointB) bounds.extend(pointB);
    if (driverPos) bounds.extend(driverPos);
    map.fitBounds(bounds, 64);
    // driverPos a propósito FUERA de las deps: solo reencuadramos al resolver B.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, pointB, pointA]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);
  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // Icono emoji sobre un pin circular (data-URI SVG, sin requests externos).
  const makeIcon = useCallback((emoji: string, ring: string): google.maps.Icon => {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">` +
      `<circle cx="23" cy="23" r="20" fill="#0f172a" stroke="${ring}" stroke-width="3"/>` +
      `<text x="23" y="31" font-size="22" text-anchor="middle">${emoji}</text></svg>`;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(46, 46),
      anchor: new google.maps.Point(23, 23),
    };
  }, []);

  if (loadError) {
    return <MapPlaceholder message={t('mapLoadError')} />;
  }

  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-slate-900/60"
        style={{ minHeight: '160px' }}
      >
        <span className="text-sm text-slate-400">{t('mapLoading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!hasRestaurant && (
        <p className="text-xs text-amber-300/90">⚠️ {t('restaurantLocationMissing')}</p>
      )}
      {geocodeFailed && <p className="text-xs text-amber-300/90">⚠️ {t('geocodeFailed')}</p>}

      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={driverPos ?? pointA}
        zoom={14}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={{
          styles: DARK_MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          clickableIcons: false,
        }}
      >
        <Marker position={pointA} icon={makeIcon('🏪', '#f59e0b')} title={t('mapPointA')} />
        {pointB && <Marker position={pointB} icon={makeIcon('🏠', '#38bdf8')} title={t('mapPointB')} />}
        {driverPos && (
          <Marker position={driverPos} icon={makeIcon('🛵', '#14b8a6')} title={t('mapDriver')} />
        )}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              preserveViewport: true,
              polylineOptions: { strokeColor: '#2dd4bf', strokeWeight: 5, strokeOpacity: 0.9 },
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
