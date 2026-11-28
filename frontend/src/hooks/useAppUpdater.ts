import { useEffect, useRef } from 'react';
import { useUpdateStore } from '@/stores/updateStore';
import { updateService } from '@/services/updateService';
import { isTauriRuntime } from '@/services/api';

const STORAGE_KEY_LAST_SEEN_VERSION = 'checkpoint_last_seen_whats_new';

export function useAppUpdater() {
  const status = useUpdateStore((s) => s.status);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const availableVersion = useUpdateStore((s) => s.availableVersion);
  const releaseDate = useUpdateStore((s) => s.releaseDate);
  const releaseNotes = useUpdateStore((s) => s.releaseNotes);
  const downloadSize = useUpdateStore((s) => s.downloadSize);
  const downloadedBytes = useUpdateStore((s) => s.downloadedBytes);
  const downloadSpeed = useUpdateStore((s) => s.downloadSpeed);
  const progressPct = useUpdateStore((s) => s.progressPct);
  const errorMessage = useUpdateStore((s) => s.errorMessage);
  const lastChecked = useUpdateStore((s) => s.lastChecked);
  const dialogOpen = useUpdateStore((s) => s.dialogOpen);
  const whatsNewOpen = useUpdateStore((s) => s.whatsNewOpen);
  const preferences = useUpdateStore((s) => s.preferences);

  const setDialogOpen = useUpdateStore((s) => s.setDialogOpen);
  const setWhatsNewOpen = useUpdateStore((s) => s.setWhatsNewOpen);
  const skipVersion = useUpdateStore((s) => s.skipVersion);
  const updatePreferences = useUpdateStore((s) => s.updatePreferences);

  const initialCheckDone = useRef(false);

  // Sync actual application version from Tauri runtime
  useEffect(() => {
    if (isTauriRuntime()) {
      import('@tauri-apps/api/app')
        .then(({ getVersion }) => getVersion())
        .then((version) => {
          if (version) {
            useUpdateStore.getState().setCurrentVersion(version);
          }
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    // 1. One-time "What's New" check after major version upgrade
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY_LAST_SEEN_VERSION);
      if (lastSeen !== currentVersion) {
        localStorage.setItem(STORAGE_KEY_LAST_SEEN_VERSION, currentVersion);
        // Show What's New once after a brief welcome delay
        const timer = setTimeout(() => {
          setWhatsNewOpen(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [currentVersion, setWhatsNewOpen]);

  useEffect(() => {
    if (!preferences.autoCheck || initialCheckDone.current) return;
    initialCheckDone.current = true;

    // Run non-blocking check after startup
    const startupTimer = setTimeout(() => {
      updateService.checkForUpdates(false);
    }, 4000);

    // Set periodic check timer
    const intervalMs = Math.max(1, preferences.checkIntervalHours) * 60 * 60 * 1000;
    const intervalTimer = setInterval(() => {
      updateService.checkForUpdates(false);
    }, intervalMs);

    // Online event handler
    const handleOnline = () => {
      updateService.checkForUpdates(false);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(startupTimer);
      clearInterval(intervalTimer);
      window.removeEventListener('online', handleOnline);
    };
  }, [preferences.autoCheck, preferences.checkIntervalHours]);

  return {
    status,
    currentVersion,
    availableVersion,
    releaseDate,
    releaseNotes,
    downloadSize,
    downloadedBytes,
    downloadSpeed,
    progressPct,
    errorMessage,
    lastChecked,
    dialogOpen,
    whatsNewOpen,
    preferences,
    hasUpdate: status === 'available' || status === 'downloading' || status === 'ready',
    checkForUpdates: (manual = true) => updateService.checkForUpdates(manual),
    downloadAndInstall: () => updateService.downloadAndInstall(),
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    openWhatsNew: () => setWhatsNewOpen(true),
    closeWhatsNew: () => setWhatsNewOpen(false),
    skipVersion,
    updatePreferences,
  };
}
