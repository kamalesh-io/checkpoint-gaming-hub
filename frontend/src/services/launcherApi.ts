import { invoke } from '@tauri-apps/api/core';
import { apiClient } from './api';
import type {
  DetectorStatusResponse,
  InstalledGameInfo,
  LaunchConfigResponse,
  SetLaunchConfigRequest,
} from '@/types';

export const launcherApi = {
  getDetectorStatus: async (): Promise<DetectorStatusResponse> => {
    return apiClient.get<DetectorStatusResponse>('/launcher/status');
  },

  getInstalledSteamGames: async (): Promise<InstalledGameInfo[]> => {
    return apiClient.get<InstalledGameInfo[]>('/launcher/installed-steam');
  },

  getLaunchConfig: async (gameId: string): Promise<LaunchConfigResponse> => {
    return apiClient.get<LaunchConfigResponse>(`/launcher/games/${gameId}`);
  },

  setLaunchConfig: async (
    gameId: string,
    req: SetLaunchConfigRequest,
  ): Promise<LaunchConfigResponse> => {
    return apiClient.post<LaunchConfigResponse>(`/launcher/games/${gameId}`, req);
  },

  // Native Tauri IPC commands
  launchSteamGame: async (appId: number, minimizeOnLaunch = false): Promise<void> => {
    try {
      await invoke('launch_steam_game', { appId, minimizeOnLaunch });
    } catch (err) {
      // In web browser or mock dev mode, provide safe fallback
      console.warn('Native launch_steam_game fallback:', err);
      window.open(`steam://run/${appId}`, '_blank');
    }
  },

  launchExecutable: async (
    exePath: string,
    args?: string[],
    minimizeOnLaunch = false,
  ): Promise<number> => {
    try {
      return await invoke<number>('launch_executable', {
        exePath,
        args: args || null,
        minimizeOnLaunch,
      });
    } catch (err) {
      console.error('Failed to launch executable:', err);
      throw err;
    }
  },

  restoreWindow: async (): Promise<void> => {
    try {
      await invoke('restore_window');
    } catch (err) {
      console.warn('Native restore_window fallback:', err);
    }
  },
};
