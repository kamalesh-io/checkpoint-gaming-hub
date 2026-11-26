import { apiClient } from './api';
import type { WishlistPricesResponse } from '@/types';

export const pricesApi = {
  getPrices: async (refresh = false): Promise<WishlistPricesResponse> => {
    return apiClient.get<WishlistPricesResponse>('/wishlist/prices', { refresh });
  },

  refreshPrices: async (): Promise<WishlistPricesResponse> => {
    return apiClient.post<WishlistPricesResponse>('/wishlist/prices/refresh');
  },
};
