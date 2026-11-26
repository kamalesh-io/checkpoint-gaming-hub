import { apiClient } from '@/services/api';
import type {
  BackupCreateResponse,
  BackupFileItem,
  LibraryImportResult,
  RestoreResponse,
} from '@/types';

export const backupApi = {
  create: () => apiClient.post<BackupCreateResponse>('/system/backup'),

  list: () => apiClient.get<BackupFileItem[]>('/system/backup/list'),

  restore: (filename: string) =>
    apiClient.post<RestoreResponse>('/system/backup/restore', { filename, confirm: true }),

  exportJson: () => apiClient.get<Record<string, unknown>>('/system/backup/export-json'),

  importJson: (payload: Record<string, unknown>) =>
    apiClient.post<LibraryImportResult>('/system/backup/import-json', payload),

  clearArtworkCache: () =>
    apiClient.post<{ status: string; cleared_files: number; cleared_bytes: number; formatted_size: string }>(
      '/system/backup/clear-cache',
    ),
};
