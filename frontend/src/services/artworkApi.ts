import { apiClient } from '@/services/api';
import type {
  ArtworkRead,
  ArtworkSelectRequest,
  CacheStatusResponse,
} from '@/types';

export const artworkApi = {
  getCacheStatus: (signal?: AbortSignal) =>
    apiClient.get<CacheStatusResponse>('/artwork/cache/status', undefined, signal),

  getArtworkDetails: (assetId: string, signal?: AbortSignal) =>
    apiClient.get<ArtworkRead>(`/artwork/${assetId}`, undefined, signal),

  selectArtwork: (payload: ArtworkSelectRequest) =>
    apiClient.post<ArtworkRead>('/artwork/select', payload, undefined, 20000),
};
