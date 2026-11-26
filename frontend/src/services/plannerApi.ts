import { apiClient } from '@/services/api';
import type {
  ScheduledSessionCompleteRequest,
  ScheduledSessionCreate,
  ScheduledSessionRead,
  ScheduledSessionUpdate,
} from '@/types';

export interface PlannerListParams {
  [key: string]: string | number | boolean | null | undefined;
  start?: string;
  end?: string;
  status?: string;
}

export const plannerApi = {
  listSessions: (params: PlannerListParams = {}) =>
    apiClient.get<ScheduledSessionRead[]>('/planner/sessions', params),

  createSession: (payload: ScheduledSessionCreate) =>
    apiClient.post<ScheduledSessionRead>('/planner/sessions', payload),

  updateSession: (sessionId: string, payload: ScheduledSessionUpdate) =>
    apiClient.patch<ScheduledSessionRead>(`/planner/sessions/${sessionId}`, payload),

  completeSession: (sessionId: string, payload?: ScheduledSessionCompleteRequest) =>
    apiClient.post<ScheduledSessionRead>(`/planner/sessions/${sessionId}/complete`, payload ?? {}),

  deleteSession: (sessionId: string) =>
    apiClient.delete(`/planner/sessions/${sessionId}`),
};

