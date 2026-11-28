import { create } from 'zustand';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'installing'
  | 'restart-required'
  | 'error'
  | 'offline';

export interface UpdatePreferences {
  autoCheck: boolean;
  autoDownload: boolean;
  notifyAvailable: boolean;
  checkIntervalHours: number;
  deferWhileGaming: boolean;
}

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  downloadSize: number | null;
  downloadedBytes: number;
  downloadSpeed: number; // bytes per second
  progressPct: number;
  errorMessage: string | null;
  lastChecked: string | null;
  dialogOpen: boolean;
  whatsNewOpen: boolean;
  skippedVersions: string[];
  preferences: UpdatePreferences;
  
  // Actions
  setStatus: (status: UpdateStatus) => void;
  setCurrentVersion: (version: string) => void;
  setUpdateInfo: (info: {
    availableVersion: string;
    releaseDate?: string;
    releaseNotes?: string;
    downloadSize?: number;
  }) => void;
  setProgress: (downloaded: number, total: number | null, speed: number) => void;
  setError: (message: string) => void;
  setLastChecked: (isoString: string) => void;
  setDialogOpen: (open: boolean) => void;
  setWhatsNewOpen: (open: boolean) => void;
  skipVersion: (version: string) => void;
  updatePreferences: (prefs: Partial<UpdatePreferences>) => void;
  resetProgress: () => void;
}

const STORAGE_KEY_PREFS = 'checkpoint_update_preferences';
const STORAGE_KEY_SKIPPED = 'checkpoint_skipped_versions';
const STORAGE_KEY_LAST_CHECKED = 'checkpoint_last_update_check';

function loadStoredPreferences(): UpdatePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    if (raw) {
      return {
        autoCheck: true,
        autoDownload: false,
        notifyAvailable: true,
        checkIntervalHours: 24,
        deferWhileGaming: true,
        ...JSON.parse(raw),
      };
    }
  } catch {
    // fallback
  }
  return {
    autoCheck: true,
    autoDownload: false,
    notifyAvailable: true,
    checkIntervalHours: 24,
    deferWhileGaming: true,
  };
}

function loadSkippedVersions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SKIPPED);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return [];
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: 'idle',
  currentVersion: '1.1.0',
  availableVersion: null,
  releaseDate: null,
  releaseNotes: null,
  downloadSize: null,
  downloadedBytes: 0,
  downloadSpeed: 0,
  progressPct: 0,
  errorMessage: null,
  lastChecked: localStorage.getItem(STORAGE_KEY_LAST_CHECKED),
  dialogOpen: false,
  whatsNewOpen: false,
  skippedVersions: loadSkippedVersions(),
  preferences: loadStoredPreferences(),

  setStatus: (status) => set({ status }),
  setCurrentVersion: (currentVersion) => set({ currentVersion }),
  setUpdateInfo: (info) =>
    set({
      availableVersion: info.availableVersion,
      releaseDate: info.releaseDate ?? null,
      releaseNotes: info.releaseNotes ?? null,
      downloadSize: info.downloadSize ?? null,
    }),
  setProgress: (downloadedBytes, total, downloadSpeed) => {
    let progressPct = 0;
    if (total && total > 0) {
      progressPct = Math.min(100, Math.round((downloadedBytes / total) * 100));
    }
    set({
      downloadedBytes,
      downloadSize: total ?? get().downloadSize,
      downloadSpeed,
      progressPct,
    });
  },
  setError: (errorMessage) => set({ status: 'error', errorMessage }),
  setLastChecked: (lastChecked) => {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_CHECKED, lastChecked);
    } catch {
      // ignore
    }
    set({ lastChecked });
  },
  setDialogOpen: (dialogOpen) => set({ dialogOpen }),
  setWhatsNewOpen: (whatsNewOpen) => set({ whatsNewOpen }),
  skipVersion: (version) => {
    const current = get().skippedVersions;
    if (!current.includes(version)) {
      const updated = [...current, version];
      try {
        localStorage.setItem(STORAGE_KEY_SKIPPED, JSON.stringify(updated));
      } catch {
        // ignore
      }
      set({ skippedVersions: updated, dialogOpen: false });
    }
  },
  updatePreferences: (prefs) => {
    const updated = { ...get().preferences, ...prefs };
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(updated));
    } catch {
      // ignore
    }
    set({ preferences: updated });
  },
  resetProgress: () =>
    set({
      downloadedBytes: 0,
      downloadSpeed: 0,
      progressPct: 0,
      errorMessage: null,
    }),
}));
