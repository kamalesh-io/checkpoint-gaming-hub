import { apiClient } from '@/services/api';
import type {
  CollectionCreate,
  CollectionItemAdd,
  CollectionRead,
  CollectionUpdate,
  FranchiseDetailRead,
} from '@/types';

export const collectionsApi = {
  list: () => apiClient.get<CollectionRead[]>('/collections'),

  getById: (collectionId: string) =>
    apiClient.get<CollectionRead>(`/collections/${collectionId}`),

  create: (payload: CollectionCreate) =>
    apiClient.post<CollectionRead>('/collections', payload),

  update: (collectionId: string, payload: CollectionUpdate) =>
    apiClient.patch<CollectionRead>(`/collections/${collectionId}`, payload),

  delete: (collectionId: string) =>
    apiClient.delete(`/collections/${collectionId}`),

  addItem: (collectionId: string, payload: CollectionItemAdd) =>
    apiClient.post<CollectionRead>(`/collections/${collectionId}/items`, payload),

  removeItem: (collectionId: string, libraryEntryId: string) =>
    apiClient.delete<CollectionRead>(`/collections/${collectionId}/items/${libraryEntryId}`),

  reorderItems: (collectionId: string, entryIds: string[]) =>
    apiClient.post<CollectionRead>(`/collections/${collectionId}/reorder`, { entry_ids: entryIds }),

  listFranchises: () => apiClient.get<FranchiseDetailRead[]>('/franchises'),

  updateFranchiseOrder: (franchiseId: string, items: { game_id: string; order: number }[]) =>
    apiClient.patch<FranchiseDetailRead>(`/franchises/${franchiseId}/order`, { items }),

  assignGameFranchise: (gameId: string, franchiseName: string, order = 0) =>
    apiClient.post<{ status: string; game_id: string; franchise_id: string }>(
      `/franchises/games/${gameId}/assign`,
      { franchise_name: franchiseName, order },
    ),
};

export const franchisesApi = {
  list: () => collectionsApi.listFranchises(),
  get: (id: string) => apiClient.get<FranchiseDetailRead>(`/franchises/${id}`),
  updateOrder: (franchiseId: string, items: { game_id: string; order: number }[]) =>
    collectionsApi.updateFranchiseOrder(franchiseId, items),
  assignGame: (gameId: string, franchiseName: string, order = 0) =>
    collectionsApi.assignGameFranchise(gameId, franchiseName, order),
};

