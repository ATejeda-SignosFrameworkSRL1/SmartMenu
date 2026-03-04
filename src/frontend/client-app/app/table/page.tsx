'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Grid3X3 } from 'lucide-react';

export default function TableListPage() {
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

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Grid3X3 className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mesas</h1>
            <p className="text-gray-600 text-sm">Escanea el QR de una mesa para ver el menú y pedir</p>
          </div>
        </div>
        {isLocalhost && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>Para escanear desde el móvil:</strong> abre esta misma página en el navegador usando la IP de tu PC (ej. <code className="bg-amber-100 px-1 rounded">http://192.168.1.X:3000/table</code>). Así el QR llevará al móvil a la misma red.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {tables.map((table: { id: number; tableNumber: number; capacity?: number; zoneName?: string; status?: string; qrCode?: string }) => {
            // Usar el qrCode real de la mesa, o fallback a table-{id}
            const tableIdentifier = table.qrCode || `table-${table.id}`;
            const tableUrl = `${baseUrl}/table/${tableIdentifier}`;
            return (
              <div
                key={table.id}
                className="bg-white rounded-2xl shadow-lg p-4 flex flex-col items-center border border-gray-100"
              >
                <div className="bg-white p-2 rounded-lg border border-gray-200 mb-3">
                  <QRCodeSVG value={tableUrl} size={120} level="M" />
                </div>
                <p className="font-bold text-lg text-gray-900">Mesa {table.tableNumber}</p>
                {table.zoneName && (
                  <p className="text-sm text-gray-500">{table.zoneName}</p>
                )}
                {table.capacity != null && (
                  <p className="text-xs text-gray-400">{table.capacity} personas</p>
                )}
              </div>
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
