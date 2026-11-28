import { invoke } from '@tauri-apps/api/core';
import { useUpdateStore } from '@/stores/updateStore';
import { isTauriRuntime } from '@/services/api';
import { soundManager } from '@/audio/soundManager';
import { SoundEvent } from '@/audio/soundEvents';
import { parseSemver, compareSemver, type SemverParts } from '@/utils/semver';

export { parseSemver, compareSemver, type SemverParts };

export function isNewerVersion(current: string, available: string): boolean {
  return compareSemver(available, current) > 0;
}

// In-memory reference to the active Tauri Update resource
let currentTauriUpdate: any = null;

class UpdateService {
  private isChecking = false;
  private isDownloading = false;

  async checkForUpdates(manual = false): Promise<boolean> {
    if (this.isChecking || this.isDownloading) {
      return false;
    }

    const store = useUpdateStore.getState();

    // Check internet connection
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      store.setStatus('offline');
      if (manual) {
        soundManager.play(SoundEvent.ERROR);
      }
      return false;
    }

    // Check if gaming and defer updates is enabled
    if (store.preferences.deferWhileGaming && !manual) {
      const isGaming = await this.checkIfGamingActive();
      if (isGaming) {
        console.log('[UpdateService] Update check deferred: active gaming session in progress.');
        return false;
      }
    }

    this.isChecking = true;
    store.setStatus('checking');

    try {
      if (!isTauriRuntime()) {
        // Mock / Web environment check for preview & tests
        await new Promise((r) => setTimeout(r, 800));
        store.setLastChecked(new Date().toISOString());
        store.setStatus('up-to-date');
        this.isChecking = false;
        return false;
      }

      // Dynamic import of Tauri updater plugin
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      store.setLastChecked(new Date().toISOString());

      if (update) {
        // Verify semantic versioning
        const hasNewer = isNewerVersion(store.currentVersion, update.version);
        if (hasNewer) {
          // Check if user chose to skip this specific version (unless manual check)
          if (!manual && store.skippedVersions.includes(update.version)) {
            store.setStatus('idle');
            this.isChecking = false;
            return false;
          }

          currentTauriUpdate = update;
          store.setUpdateInfo({
            availableVersion: update.version,
            releaseDate: update.date,
            releaseNotes: update.body,
          });
          store.setStatus('available');

          if (store.preferences.notifyAvailable) {
            soundManager.play(SoundEvent.DONE);
            // Prompt the user with the update dialog
            store.setDialogOpen(true);
          }

          // Auto-download if user enabled it in preferences
          if (store.preferences.autoDownload) {
            this.downloadAndInstall();
          }

          this.isChecking = false;
          return true;
        }
      }

      store.setStatus('up-to-date');
      if (manual) {
        soundManager.play(SoundEvent.SELECT);
      }
      this.isChecking = false;
      return false;
    } catch (err: unknown) {
      console.error('[UpdateService] Error checking for updates:', err);
      const msg = err instanceof Error ? err.message : 'Failed to connect to update server.';
      store.setError(msg);
      if (manual) {
        soundManager.play(SoundEvent.ERROR);
      }
      this.isChecking = false;
      return false;
    }
  }

  async downloadAndInstall(): Promise<void> {
    if (this.isDownloading) return;
    if (!currentTauriUpdate) {
      useUpdateStore.getState().setError('No active update available for installation.');
      return;
    }

    const store = useUpdateStore.getState();
    store.resetProgress();
    store.setStatus('downloading');
    this.isDownloading = true;

    try {
      let downloaded = 0;
      let totalBytes: number | null = null;
      let lastTime = performance.now();
      let lastBytes = 0;

      await currentTauriUpdate.download((event: any) => {
        const now = performance.now();
        if (event.event === 'Started') {
          totalBytes = event.data?.contentLength ?? null;
          store.setProgress(0, totalBytes, 0);
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const timeDelta = (now - lastTime) / 1000;
          let speed = 0;
          if (timeDelta >= 0.5) {
            speed = (downloaded - lastBytes) / timeDelta;
            lastTime = now;
            lastBytes = downloaded;
          }
          store.setProgress(downloaded, totalBytes, speed);
        } else if (event.event === 'Finished') {
          store.setStatus('verifying');
        }
      });

      // Prepare safe migration & shutdown backend before installing
      store.setStatus('installing');
      await this.safePrepareBackendShutdown();

      // Launch Windows installer & exit cleanly
      soundManager.play(SoundEvent.DONE);
      await currentTauriUpdate.install();
    } catch (err: unknown) {
      console.error('[UpdateService] Download/install error:', err);
      const msg = err instanceof Error ? err.message : 'Update installation failed.';
      store.setError(msg);
      soundManager.play(SoundEvent.ERROR);
    } finally {
      this.isDownloading = false;
    }
  }

  private async safePrepareBackendShutdown(): Promise<void> {
    try {
      // 1. Trigger online SQLite backup via backend API if available
      try {
        const token = localStorage.getItem('checkpoint_api_token') || '';
        await fetch('http://127.0.0.1:8765/api/v1/backup', {
          method: 'POST',
          headers: {
            'X-Checkpoint-Token': token,
            'Content-Type': 'application/json',
          },
        });
        console.log('[UpdateService] Pre-update SQLite safety backup created.');
      } catch (backupErr) {
        console.warn('[UpdateService] Safety backup call skipped or failed:', backupErr);
      }

      // 2. Instruct Tauri process manager to terminate backend cleanly so .exe is unlocked
      if (isTauriRuntime()) {
        await invoke('prepare_for_update');
        console.log('[UpdateService] Backend sidecar terminated for update replacement.');
      }
    } catch (err) {
      console.warn('[UpdateService] Backend preparation notice:', err);
    }
  }

  private async checkIfGamingActive(): Promise<boolean> {
    try {
      const token = localStorage.getItem('checkpoint_api_token') || '';
      const res = await fetch('http://127.0.0.1:8765/api/v1/sessions/active', {
        headers: { 'X-Checkpoint-Token': token },
      });
      if (res.ok) {
        const data = await res.json();
        return Boolean(data && data.id);
      }
    } catch {
      // ignore
    }
    return false;
  }
}

export const updateService = new UpdateService();
