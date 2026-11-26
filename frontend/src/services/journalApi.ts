import { apiClient } from '@/services/api';
import type { JournalEntryCreate, JournalEntryRead, JournalEntryUpdate } from '@/types';

export interface JournalListParams {
  [key: string]: string | number | boolean | null | undefined;
  entry_id?: string;
  type?: string;
  spoiler?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

export const journalApi = {
  list: (params: JournalListParams = {}) =>
    apiClient.get<JournalEntryRead[]>('/journal', params),

  listByGame: (entryId: string) =>
    apiClient.get<JournalEntryRead[]>('/journal', { entry_id: entryId }),

  getById: (entryId: string) =>
    apiClient.get<JournalEntryRead>(`/journal/${entryId}`),

  create: (payload: JournalEntryCreate) =>
    apiClient.post<JournalEntryRead>('/journal', payload),

  update: (entryId: string, payload: JournalEntryUpdate) =>
    apiClient.patch<JournalEntryRead>(`/journal/${entryId}`, payload),

  delete: (entryId: string) =>
    apiClient.delete(`/journal/${entryId}`),
};
