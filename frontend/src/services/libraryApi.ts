import { apiClient } from '@/services/api';
import type {
  LibraryEntryCreate,
  LibraryEntryRead,
  LibraryEntryUpdate,
  PaginatedResponse,
} from '@/types';

export interface LibraryListParams {
  status?: string;
  ownership_status?: string;
  platform?: string;
  priority?: string;
  genre?: string;
  is_favorite?: boolean;
  q?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export const libraryApi = {
  list: (params: LibraryListParams = {}, signal?: AbortSignal) =>
    apiClient.get<PaginatedResponse<LibraryEntryRead>>(
      '/library',
      {
        status: params.status,
        ownership_status: params.ownership_status,
        platform: params.platform,
        priority: params.priority,
        genre: params.genre,
        is_favorite: params.is_favorite,
        q: params.q,
        sort: params.sort,
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      },
      signal,
    ),

  getById: (entryId: string, signal?: AbortSignal) =>
    apiClient.get<LibraryEntryRead>(`/library/${entryId}`, undefined, signal),

  addGame: (payload: LibraryEntryCreate) =>
    apiClient.post<LibraryEntryRead>('/library', payload, undefined, 25000),

  updateGame: (entryId: string, updates: LibraryEntryUpdate) =>
    apiClient.patch<LibraryEntryRead>(`/library/${entryId}`, updates),

  removeGame: (entryId: string) => apiClient.delete(`/library/${entryId}`),
};
