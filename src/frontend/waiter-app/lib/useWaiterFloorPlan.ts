'use client';

import { api, ensureFreshToken } from '@/lib/api';
import { useFloorPlanReadOnly, type FloorPlanTableEvent } from '@smartmenu/ui';

export function useWaiterFloorPlan(opts?: {

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
