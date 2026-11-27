import { useQuery } from '@tanstack/react-query';
import { apiClient, CheckpointApiError } from '@/services/api';
import { systemApi } from '@/services/systemApi';
import { queryKeys } from './queryKeys';

function shouldRetrySystemQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof CheckpointApiError && (error.isAuthError || error.status === 422)) {
    return false;
  }
  return failureCount < 15;
}

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.system.health,
    queryFn: async ({ signal }) => {
      await apiClient.initializeSession();
      return systemApi.checkHealth(signal);
    },
    retry: shouldRetrySystemQuery,
    retryDelay: (attemptIndex) => Math.min(1000 * (attemptIndex + 1), 3000),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useBackendStatusQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.system.status,
    queryFn: ({ signal }) => systemApi.getStatus(signal),
    enabled,
    retry: shouldRetrySystemQuery,
    staleTime: 15_000,
  });
}

export function useIntegrationsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.system.integrations,
    queryFn: ({ signal }) => systemApi.getIntegrations(signal),
    enabled,
    retry: shouldRetrySystemQuery,
    staleTime: 60_000,
  });
}

export function useSystemStatsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.system.stats,
    queryFn: ({ signal }) => systemApi.getStats(signal),
    enabled,
    retry: shouldRetrySystemQuery,
    staleTime: 30_000,
  });
}
