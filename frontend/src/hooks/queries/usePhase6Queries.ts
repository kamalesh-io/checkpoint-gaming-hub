import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { launcherApi } from '@/services/launcherApi';
import { pricesApi } from '@/services/pricesApi';
import { steamApi } from '@/services/steamApi';
import type {
  GameAchievementsResponse,
  LaunchConfigResponse,
  SetLaunchConfigRequest,
  SteamAccountStatus,
  SteamConnectRequest,
  SteamImportExecuteRequest,
  SteamImportExecuteResponse,
  SteamImportPreviewResponse,
  SteamTestConnectionRequest,
  SteamTestConnectionResponse,
  WishlistPricesResponse,
} from '@/types';

export const steamKeys = {
  all: ['steam'] as const,
  status: () => [...steamKeys.all, 'status'] as const,
  preview: () => [...steamKeys.all, 'preview'] as const,
  achievements: (gameId: string) => [...steamKeys.all, 'achievements', gameId] as const,
};

export const launcherKeys = {
  all: ['launcher'] as const,
  status: () => [...launcherKeys.all, 'status'] as const,
  installed: () => [...launcherKeys.all, 'installed'] as const,
  config: (gameId: string) => [...launcherKeys.all, 'config', gameId] as const,
};

export const priceKeys = {
  all: ['prices'] as const,
  wishlist: () => [...priceKeys.all, 'wishlist'] as const,
};

// Steam Account Queries
export function useSteamStatusQuery() {
  return useQuery<SteamAccountStatus>({
    queryKey: steamKeys.status(),
    queryFn: () => steamApi.getStatus(),
    staleTime: 60 * 1000,
  });
}

export function useSteamTestMutation() {
  return useMutation<SteamTestConnectionResponse, Error, SteamTestConnectionRequest>({
    mutationFn: (req) => steamApi.testConnection(req),
  });
}

export function useSteamConnectMutation() {
  const queryClient = useQueryClient();
  return useMutation<SteamAccountStatus, Error, SteamConnectRequest>({
    mutationFn: (req) => steamApi.connectAccount(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: steamKeys.status() });
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}

export function useSteamDisconnectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => steamApi.disconnectAccount(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: steamKeys.status() });
    },
  });
}

export function useSteamImportPreviewQuery(enabled = false) {
  return useQuery<SteamImportPreviewResponse>({
    queryKey: steamKeys.preview(),
    queryFn: () => steamApi.getImportPreview(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSteamImportMutation() {
  const queryClient = useQueryClient();
  return useMutation<SteamImportExecuteResponse, Error, SteamImportExecuteRequest>({
    mutationFn: (req) => steamApi.executeImport(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: steamKeys.status() });
    },
  });
}

// Achievements Queries
export function useGameAchievementsQuery(gameId?: string, enabled = true) {
  return useQuery<GameAchievementsResponse>({
    queryKey: steamKeys.achievements(gameId || ''),
    queryFn: () => steamApi.getGameAchievements(gameId || '', false),
    enabled: Boolean(gameId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSyncAchievementsMutation(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation<GameAchievementsResponse, Error, void>({
    mutationFn: () => steamApi.syncGameAchievements(gameId),
    onSuccess: (data) => {
      queryClient.setQueryData(steamKeys.achievements(gameId), data);
    },
  });
}

// Launcher & Detector Queries
export function useDetectorStatusQuery() {
  return useQuery({
    queryKey: launcherKeys.status(),
    queryFn: () => launcherApi.getDetectorStatus(),
    refetchInterval: 10 * 1000, // Adaptive background poll
    staleTime: 5 * 1000,
  });
}

export function useInstalledSteamQuery() {
  return useQuery({
    queryKey: launcherKeys.installed(),
    queryFn: () => launcherApi.getInstalledSteamGames(),
    staleTime: 60 * 1000,
  });
}

export function useLaunchConfigQuery(gameId?: string) {
  return useQuery<LaunchConfigResponse>({
    queryKey: launcherKeys.config(gameId || ''),
    queryFn: () => launcherApi.getLaunchConfig(gameId || ''),
    enabled: Boolean(gameId),
  });
}

export function useSetLaunchConfigMutation(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation<LaunchConfigResponse, Error, SetLaunchConfigRequest>({
    mutationFn: (req) => launcherApi.setLaunchConfig(gameId, req),
    onSuccess: (data) => {
      queryClient.setQueryData(launcherKeys.config(gameId), data);
    },
  });
}

// Price Tracking Queries
export function useWishlistPricesQuery() {
  return useQuery<WishlistPricesResponse>({
    queryKey: priceKeys.wishlist(),
    queryFn: () => pricesApi.getPrices(false),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshPricesMutation() {
  const queryClient = useQueryClient();
  return useMutation<WishlistPricesResponse, Error, void>({
    mutationFn: () => pricesApi.refreshPrices(),
    onSuccess: (data) => {
      queryClient.setQueryData(priceKeys.wishlist(), data);
    },
  });
}
