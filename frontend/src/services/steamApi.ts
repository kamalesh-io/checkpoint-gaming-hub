import { apiClient } from './api';
import type {
  GameAchievementsResponse,
  SteamAccountStatus,
  SteamConnectRequest,
  SteamImportExecuteRequest,
  SteamImportExecuteResponse,
  SteamImportPreviewResponse,
  SteamTestConnectionRequest,
  SteamTestConnectionResponse,
} from '@/types';

export const steamApi = {
  getStatus: async (): Promise<SteamAccountStatus> => {
    return apiClient.get<SteamAccountStatus>('/steam/status');
  },

  testConnection: async (
    req: SteamTestConnectionRequest,
  ): Promise<SteamTestConnectionResponse> => {
    return apiClient.post<SteamTestConnectionResponse>('/steam/test', req);
  },

  connectAccount: async (req: SteamConnectRequest): Promise<SteamAccountStatus> => {
    return apiClient.post<SteamAccountStatus>('/steam/connect', req);
  },

  disconnectAccount: async (): Promise<{ status: string; message: string }> => {
    return apiClient.post<{ status: string; message: string }>('/steam/disconnect');
  },

  getImportPreview: async (): Promise<SteamImportPreviewResponse> => {
    return apiClient.post<SteamImportPreviewResponse>('/steam/preview');
  },

  executeImport: async (
    req: SteamImportExecuteRequest,
  ): Promise<SteamImportExecuteResponse> => {
    return apiClient.post<SteamImportExecuteResponse>('/steam/import', req);
  },

  getGameAchievements: async (
    gameId: string,
    refresh = false,
  ): Promise<GameAchievementsResponse> => {
    return apiClient.get<GameAchievementsResponse>(
      `/steam/games/${gameId}/achievements`,
      { refresh },
    );
  },

  syncGameAchievements: async (gameId: string): Promise<GameAchievementsResponse> => {
    return apiClient.post<GameAchievementsResponse>(
      `/steam/games/${gameId}/achievements/sync`,
    );
  },
};
