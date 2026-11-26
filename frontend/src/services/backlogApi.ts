import { apiClient } from '@/services/api';
import type { BacklogReorderItem, BacklogSummaryResponse } from '@/types';

export const backlogApi = {
  getSummary: (params: { status?: string; ownership?: string; q?: string } = {}) =>
    apiClient.get<BacklogSummaryResponse>('/backlog', params),

  reorder: (items: BacklogReorderItem[]) =>
    apiClient.post<BacklogSummaryResponse>('/backlog/reorder', { items }),

  moveItem: (entryId: string, direction: 'up' | 'down') =>
    apiClient.post<BacklogSummaryResponse>(`/backlog/${entryId}/move`, { direction }),

  setAsNext: (entryId: string) =>
    apiClient.post<BacklogSummaryResponse>('/backlog/set-next', { entry_id: entryId }),
};
