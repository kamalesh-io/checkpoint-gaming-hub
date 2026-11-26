import { apiClient } from '@/services/api';
import type {
  LibraryEntryRead,
  WishlistConvertToLibraryRequest,
  WishlistItemCreate,
  WishlistItemRead,
  WishlistItemUpdate,
} from '@/types';

export interface WishlistListParams {
  [key: string]: string | number | boolean | null | undefined;
  priority?: string;
  store?: string;
}

export const wishlistApi = {
  list: (params: WishlistListParams = {}) =>
    apiClient.get<WishlistItemRead[]>('/wishlist', params),

  addItem: (payload: WishlistItemCreate) =>
    apiClient.post<WishlistItemRead>('/wishlist', payload),

  updateItem: (itemId: string, payload: WishlistItemUpdate) =>
    apiClient.patch<WishlistItemRead>(`/wishlist/${itemId}`, payload),

  removeItem: (itemId: string) =>
    apiClient.delete(`/wishlist/${itemId}`),

  convertToLibrary: (itemId: string, payload: WishlistConvertToLibraryRequest) =>
    apiClient.post<LibraryEntryRead>(`/wishlist/${itemId}/convert-to-library`, payload),
};
