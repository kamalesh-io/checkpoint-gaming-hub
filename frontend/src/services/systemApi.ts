import { apiClient } from '@/services/api';
import type {
  BackendHealthStatus,
  IntegrationStatus,
  SystemStatsResponse,
  TestServiceConnectionRequest,
  TestServiceConnectionResponse,
} from '@/types';

export interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  location: string;
  message: string;
}

export interface SystemLogsResponse {
  total: number;
  buffer_total: number;
  logs: LogEntry[];
}

export const systemApi = {
  checkHealth: (signal?: AbortSignal) =>
    apiClient.get<BackendHealthStatus>('/system/health', undefined, signal, 2500),

  getStatus: (signal?: AbortSignal) =>
    apiClient.get<BackendHealthStatus>('/system/status', undefined, signal, 3000),

  getIntegrations: (signal?: AbortSignal) =>
    apiClient.get<IntegrationStatus>('/system/integrations', undefined, signal),

  getStats: (signal?: AbortSignal) =>
    apiClient.get<SystemStatsResponse>('/system/stats', undefined, signal),

  getLogs: (params?: { level?: string; search?: string; limit?: number }, signal?: AbortSignal) =>
    apiClient.get<SystemLogsResponse>('/system/logs', params as Record<string, string | number | undefined>, signal),

  clearLogs: (signal?: AbortSignal) =>
    apiClient.delete<{ status: string }>('/system/logs', signal),

  updateCredentials: (
    data: {
      igdb_client_id?: string;
      igdb_client_secret?: string;
      steamgriddb_api_key?: string;
      steam_web_api_key?: string;
      itad_api_key?: string;
    },
    signal?: AbortSignal,
  ) =>
    apiClient.post<IntegrationStatus>(
      '/system/credentials',
      data,
      signal,
    ),

  testServiceConnection: (
    data: TestServiceConnectionRequest,
    signal?: AbortSignal,
  ) =>
    apiClient.post<TestServiceConnectionResponse>(
      '/system/test-service',
      data,
      signal,
    ),
};
