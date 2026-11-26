import { apiClient } from '@/services/api';

export const appSettingsApi = {
  getAll: () => apiClient.get<Record<string, unknown>>('/settings'),

  get: (key: string) => apiClient.get<{ key: string; value: unknown }>(`/settings/${key}`),

  set: (key: string, value: unknown) =>
    apiClient.put<{ status: string; key: string; value: unknown }>(`/settings/${key}`, { value }),

  setBatch: (settings: Record<string, unknown>) =>
    apiClient.post<{ status: string; updated_keys: string[] }>('/settings/batch', { settings }),
};

export const settingsApi = appSettingsApi;

