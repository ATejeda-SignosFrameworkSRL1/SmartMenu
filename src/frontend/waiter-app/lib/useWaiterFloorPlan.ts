'use client';

// DEDUP-FLOORPLAN.1 — La logica vive en @smartmenu/ui (useFloorPlanReadOnly);
// este wrapper solo inyecta el cliente API, el token y la visibilidad del waiter.
// El poll de respaldo de 60s y la reconexion SignalR se preservan en el hook compartido.

import { api, ensureFreshToken } from '@/lib/api';
import { useFloorPlanReadOnly, type FloorPlanTableEvent } from '@smartmenu/ui';

/**
 * Plano de salón en SOLO LECTURA para la waiter-app: GET /api/floorplan (layout +
 * estado + colores + mesero) con overlay en vivo por /hubs/tables (TableStatusChanged
 * + TableWaiterChanged). Sin edición (no PUT).
 */
export function useWaiterFloorPlan(opts?: {
  /** Se dispara con cada evento de /hubs/tables, para que la grilla principal se actualice en vivo. */
  onTableEvent?: (e: FloorPlanTableEvent) => void;
}) {
  return useFloorPlanReadOnly({
    tokenKey: 'waiter_token',
    getAccessToken: () => ensureFreshToken(),
    fetchFloorPlan: async () => (await api.get('/api/floorplan')).data,
    enabledField: 'waiterEnabled',
    logTag: 'waiter',
    onTableEvent: opts?.onTableEvent,
  });
}
