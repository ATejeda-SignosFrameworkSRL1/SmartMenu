'use client';

// DEDUP-FLOORPLAN.1 — La logica vive en @smartmenu/ui (useFloorPlanReadOnly);
// este wrapper solo inyecta el cliente API, el token y la visibilidad del host.
// El poll de respaldo de 60s y la reconexion SignalR se preservan en el hook compartido.

import { createAuthApi, ensureFreshToken } from '@/lib/auth-client';
import { useFloorPlanReadOnly } from '@smartmenu/ui';

const { api } = createAuthApi('host');

/**
 * Plano de salón en SOLO LECTURA para el host-app: GET /api/floorplan (layout +
 * estado + colores) con overlay en vivo por /hubs/tables (TableStatusChanged +
 * TableWaiterChanged). Sin edición.
 */
export function useHostFloorPlan() {
  return useFloorPlanReadOnly({
    tokenKey: 'host_token',
    getAccessToken: () => ensureFreshToken('host'),
    fetchFloorPlan: async () => (await api.get('/api/floorplan')).data,
    enabledField: 'hostEnabled',
    logTag: 'host',
  });
}
