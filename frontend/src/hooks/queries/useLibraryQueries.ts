import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckpointApiError } from '@/services/api';
import { libraryApi, type LibraryListParams } from '@/services/libraryApi';
import type { LibraryEntryCreate, LibraryEntryUpdate } from '@/types';
import { queryKeys } from './queryKeys';

function shouldRetryLibrary(failureCount: number, error: unknown): boolean {
  if (
    error instanceof CheckpointApiError &&
    (error.isAuthError || error.status === 404 || error.status === 422)
  ) {
    return false;
  }
  return failureCount < 1;
}

export function useLibraryQuery(params: LibraryListParams = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.library.list(params),
    queryFn: ({ signal }) => libraryApi.list(params, signal),
    enabled,
    retry: shouldRetryLibrary,
    staleTime: 30_000,
  });
}

export function useLibraryEntryQuery(entryId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.library.detail(entryId ?? ''),
    queryFn: ({ signal }) => libraryApi.getById(entryId!, signal),
    enabled: Boolean(entryId),
    retry: shouldRetryLibrary,
    staleTime: 30_000,
  });
}

export function useAddGameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LibraryEntryCreate) => libraryApi.addGame(payload),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKeys.library.detail(created.id), created);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.search.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.artwork.cacheStatus });
    },
  });
}

export function useUpdateGameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, updates }: { entryId: string; updates: LibraryEntryUpdate }) =>
      libraryApi.updateGame(entryId, updates),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.library.detail(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}

export function useRemoveGameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId: string) => libraryApi.removeGame(entryId),
    onSuccess: (_, entryId) => {
      queryClient.removeQueries({ queryKey: queryKeys.library.detail(entryId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.system.stats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.search.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.artwork.cacheStatus });
    },
  });
}
