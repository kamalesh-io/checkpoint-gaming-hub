import { apiClient } from '@/services/api';
import type {
  ActiveSessionEndRequest,
  ActiveSessionRead,
  ActiveSessionStart,
  PlaySessionCreate,
  PlaySessionRead,
  PlaySessionUpdate,
} from '@/types';

export interface SessionHistoryParams {
  [key: string]: string | number | boolean | null | undefined;
  entry_id?: string;
  limit?: number;
  offset?: number;
}

export const sessionsApi = {
  getActive: () => apiClient.get<ActiveSessionRead | null>('/sessions/active'),

  start: (payload: ActiveSessionStart) =>
    apiClient.post<ActiveSessionRead>('/sessions/start', payload),

  pause: () => apiClient.post<ActiveSessionRead>('/sessions/pause'),

  resume: () => apiClient.post<ActiveSessionRead>('/sessions/resume'),

  end: (payload?: ActiveSessionEndRequest) =>
    apiClient.post<PlaySessionRead>('/sessions/end', payload ?? {}),

  discard: () => apiClient.post<void>('/sessions/discard'),

  logManual: (payload: PlaySessionCreate) =>
    apiClient.post<PlaySessionRead>('/sessions/manual', payload),

  listHistory: (params: SessionHistoryParams = {}) =>
    apiClient.get<PlaySessionRead[]>('/sessions/history', params),

  updateHistory: (sessionId: string, payload: PlaySessionUpdate) =>
    apiClient.patch<PlaySessionRead>(`/sessions/history/${sessionId}`, payload),

  deleteHistory: (sessionId: string) =>
    apiClient.delete(`/sessions/history/${sessionId}`),
};
