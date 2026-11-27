import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { artworkApi } from '@/services/artworkApi';
import type { ArtworkSelectRequest } from '@/types';
import { queryKeys } from './queryKeys';

export function useCacheStatusQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.artwork.cacheStatus,
    queryFn: ({ signal }) => artworkApi.getCacheStatus(signal),
    enabled,
    staleTime: 30_000,
  });
}

export function useSelectArtworkMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ArtworkSelectRequest) => artworkApi.selectArtwork(payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      if (variables.game_id) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.library.detail(variables.game_id),
        });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.artwork.cacheStatus });
      void queryClient.invalidateQueries({ queryKey: queryKeys.search.all });
    },
  });
}
