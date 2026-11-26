import { useQuery } from '@tanstack/react-query';
import { CheckpointApiError } from '@/services/api';
import { searchApi } from '@/services/searchApi';
import { queryKeys } from './queryKeys';

function shouldRetryExternalSearch(failureCount: number, error: unknown): boolean {
  if (
    error instanceof CheckpointApiError &&
    (error.isAuthError ||
      error.isRateLimitError ||
      error.status === 422 ||
      error.status === 404 ||
      error.isExternalProviderError)
  ) {
    return false;
  }
  return failureCount < 1;
}

export function useIgdbSearchQuery(debouncedQuery: string, limit = 12) {
  const trimmed = debouncedQuery.trim();
  return useQuery({
    queryKey: queryKeys.search.igdb(trimmed, limit),
    queryFn: ({ signal }) => searchApi.searchIGDB(trimmed, limit, signal),
    enabled: trimmed.length >= 2,
    retry: shouldRetryExternalSearch,
    staleTime: 120_000,
    placeholderData: (previous) => previous,
  });
}

export function useIgdbGameDetailsQuery(igdbId: number | null) {
  return useQuery({
    queryKey: queryKeys.search.details(igdbId ?? 0),
    queryFn: ({ signal }) => searchApi.getGameDetails(igdbId!, signal),
    enabled: typeof igdbId === 'number' && igdbId > 0,
    retry: shouldRetryExternalSearch,
    staleTime: 300_000,
  });
}

export function useSteamGridDbArtworkQuery(igdbId: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.search.artwork(igdbId ?? 0),
    queryFn: ({ signal }) => searchApi.getGameArtworkOptions(igdbId!, signal),
    enabled: enabled && typeof igdbId === 'number' && igdbId > 0,
    retry: shouldRetryExternalSearch,
    staleTime: 300_000,
  });
}
