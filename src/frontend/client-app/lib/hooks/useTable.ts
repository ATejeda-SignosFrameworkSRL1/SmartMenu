import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import type { TableInfo } from '@/types';

export function useTable(qrCode: string) {
  return useQuery<{ data: TableInfo }>({
    queryKey: ['table', qrCode],
    queryFn: () => apiClient.getTableByQR(qrCode),
    enabled: !!qrCode,
  });
}
