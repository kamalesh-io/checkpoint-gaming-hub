import { apiClient } from '@/services/api';
import type { GamingStatsResponse } from '@/types';

export const statsApi = {
  getAnalytics: (params: { start?: string; end?: string } = {}) =>
    apiClient.get<GamingStatsResponse>('/stats', params),
};
