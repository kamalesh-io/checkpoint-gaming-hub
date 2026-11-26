import { apiClient } from '@/services/api';
import type {
  IGDBGameDetails,
  IGDBSearchResponse,
  SteamGridDBAssetsResponse,
} from '@/types';

export const searchApi = {
  searchIGDB: (query: string, limit = 12, signal?: AbortSignal) =>
    apiClient.get<IGDBSearchResponse>('/search/igdb', { q: query, limit }, signal, 15000),

  getGameDetails: (igdbId: number, signal?: AbortSignal) =>
    apiClient.get<IGDBGameDetails>(`/games/${igdbId}`, undefined, signal, 15000),

  getGameArtworkOptions: (igdbId: number, signal?: AbortSignal) =>
    apiClient.get<SteamGridDBAssetsResponse>(
      `/games/${igdbId}/artwork`,
      undefined,
      signal,
      20000,
    ),
};
