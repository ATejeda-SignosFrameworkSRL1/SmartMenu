import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import type { Category } from '@/types';

export function useMenu(restaurantId?: number) {
  return useQuery<{ data: Category[] }>({
    queryKey: ['menu', restaurantId ?? 'default'],
    queryFn: () =>
      restaurantId != null
        ? apiClient.getMenuByRestaurant(restaurantId)
        : apiClient.getMenu(),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useDishes(categoryId?: number) {
  return useQuery({
    queryKey: ['dishes', categoryId],
    queryFn: () => apiClient.getDishes(categoryId),
    staleTime: 5 * 60 * 1000,
  });
}
