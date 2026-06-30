'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Grid3X3 } from 'lucide-react';

/**
 * URL base usada al codificar los QR físicos.
 * Debe ser alcanzable desde el CELULAR del cliente — NUNCA localhost.
 * Prioridad:
 *   1. NEXT_PUBLIC_CLIENT_URL (build-time, ej. https://client.172-31-98-50.nip.io:8443)
 *   2. Fallback runtime: derivar del hostname actual
 *      - Si hostname=localhost → usar hardcoded LAN nip.io
 *      - Si hostname=client.X.nip.io → mismo origin (ya es accesible)
 *      - Si IP directa → mismo origin
 */
function deriveQrBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_CLIENT_URL;
  if (envUrl) return envUrl;
  if (typeof window === 'undefined') return '';

  const { hostname, origin } = window.location;

  // Localhost: el QR sería inalcanzable desde celular → usar nip.io hardcoded
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'https://client.172-31-98-50.nip.io:8443';
  }

  // Cualquier otro host (nip.io, IP LAN, dominio real) → mismo origin
  return origin;
}

export default function TableListPage() {
  const router = useRouter();

  const { data: tablesRes, isLoading, error } = useQuery({
    queryKey: ['tables'],
    queryFn: () => apiClient.getTables(),
  });

  const tables = Array.isArray(tablesRes?.data) ? tablesRes.data : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-700">Cargando mesas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md">
          <p className="text-gray-600">No se pudieron cargar las mesas. Intenta de nuevo.</p>
        </div>
      </div>
    );
  }

  // baseUrl para los QRs físicos — debe ser alcanzable desde el celular del cliente.
  // Si estamos en localhost, usa nip.io; si no, mismo origin.
  const baseUrl = deriveQrBaseUrl();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Grid3X3 className="w-7 h-7 sm:w-8 sm:h-8 text-primary-600" />
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mesas</h1>
            <p className="text-gray-600 text-sm">Toca una mesa para ver el menú y pedir</p>
          </div>
        </div>

        {/* Grid de mesas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {tables.map((table: { id: number; tableNumber: number; capacity?: number; zoneName?: string; status?: string; qrCode?: string }) => {
            const tableIdentifier = table.qrCode || `table-${table.id}`;
            const tableUrl = `${baseUrl}/table/${tableIdentifier}`;
            return (
              <button
                key={table.id}
                onClick={() => router.push(`/table/${tableIdentifier}`)}
                className="bg-white rounded-2xl shadow-sm hover:shadow-lg active:scale-95 transition-all p-3 sm:p-4 flex flex-col items-center border border-gray-100"
              >
                <div className="bg-white p-1.5 rounded-lg border border-gray-200 mb-2">
                  <QRCodeSVG value={tableUrl} size={80} level="M" />
                </div>
                <p className="font-bold text-sm sm:text-base text-gray-900">Mesa {table.tableNumber}</p>
                {table.zoneName && (
                  <p className="text-[11px] text-gray-500">{table.zoneName}</p>
                )}
                {table.capacity != null && (
                  <p className="text-[10px] text-gray-400">{table.capacity} pers</p>
                )}
              </button>
            );
          })}
        </div>

        {tables.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay mesas configuradas.
          </div>
        )}
      </div>
    </div>
  );
}
