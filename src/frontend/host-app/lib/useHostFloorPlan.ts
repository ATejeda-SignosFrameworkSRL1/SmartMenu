'use client';

import { createAuthApi, ensureFreshToken } from '@/lib/auth-client';
import { useFloorPlanReadOnly } from '@smartmenu/ui';

const { api } = createAuthApi('host');

export function useHostFloorPlan() {
  return useFloorPlanReadOnly({
    tokenKey: 'host_token',
    getAccessToken: () => ensureFreshToken('host'),
    fetchFloorPlan: async () => (await api.get('/api/floorplan')).data,
    enabledField: 'hostEnabled',
    logTag: 'host',
  });
}
