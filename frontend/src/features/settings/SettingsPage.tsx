import { useState, useRef, type ChangeEvent } from 'react';
import {
  Bell,
  Database,
  Download,
  Gamepad2,
  Info,
  Palette,
  RefreshCw,
  Server,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import {
  useBackupsListQuery,
  useCacheStatusQuery,
  useClearArtworkCacheMutation,
  useCreateBackupMutation,
  useHealthQuery,
  useIntegrationsQuery,
  useRestoreBackupMutation,
} from '@/hooks/queries';
import { clearArtworkBlobCache } from '@/hooks/useAuthenticatedImage';
import { backupApi } from '@/services/backupApi';
import { systemApi } from '@/services/systemApi';
import { useAppStore } from '@/stores/appStore';
import { useToastStore } from '@/stores/toastStore';
import { ControllerSettingsPanel } from './ControllerSettingsPanel';
import { SteamConnectSection } from '@/features/steam/SteamConnectSection';

type SettingsTab =
  | 'appearance'
  | 'performance'
  | 'controller'
  | 'notifications'
  | 'integrations'
  | 'storage'
  | 'about';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('storage');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const setReducedMotion = useAppStore((s) => s.setReducedMotion);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const addToast = useToastStore((s) => s.addToast);

  const healthQuery = useHealthQuery();
  const integrationsQuery = useIntegrationsQuery(Boolean(healthQuery.data));
  const cacheQuery = useCacheStatusQuery(Boolean(healthQuery.data));

  // Phase 5I Backup & Restore queries
  const { data: backups, isLoading: isBackupsLoading, refetch: refetchBackups } = useBackupsListQuery();
  const createBackupMutation = useCreateBackupMutation();
  const restoreBackupMutation = useRestoreBackupMutation();
  const clearCacheMutation = useClearArtworkCacheMutation();

  const [igdbClientId, setIgdbClientId] = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');
  const [steamGridDbKey, setSteamGridDbKey] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Notifications preferences
  const [sessionReminders, setSessionReminders] = useState(true);

  const handleCreateBackup = async () => {
    try {
      const res = await createBackupMutation.mutateAsync();
      addToast({
        tone: 'success',
        title: 'SQLite Backup Created',
        message: `Created ${res.backup_filename} (${res.formatted_size}).`,
      });
      void refetchBackups();
    } catch {
      addToast({ tone: 'error', title: 'Backup Failed', message: 'Could not create online backup.' });
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (
      !window.confirm(
        `Restore database from "${filename}"? A safety snapshot will be created automatically before restoring.`,
      )
    ) {
      return;
    }
    try {
      const res = await restoreBackupMutation.mutateAsync(filename);
      addToast({
        tone: 'success',
        title: 'Database Restored',
        message: `Safety snapshot created: ${res.safety_backup_created}. Restored from ${res.restored_from}.`,
      });
      void healthQuery.refetch();
    } catch {
      addToast({ tone: 'error', title: 'Restore Failed', message: 'Could not restore database.' });
    }
  };

  const handleExportJson = async () => {
    setIsExporting(true);
    try {
      const data = await backupApi.exportJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checkpoint-library-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast({
        tone: 'success',
        title: 'Export Complete',
        message: 'Portable library JSON downloaded successfully.',
      });
    } catch {
      addToast({ tone: 'error', title: 'Export Failed', message: 'Could not export library.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportJsonFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await backupApi.importJson(json);

      addToast({
        tone: 'success',
        title: 'Import Completed',
        message: `Imported ${res.imported_games} games, ${res.imported_journals} journal entries, ${res.imported_wishlist} wishlist items (Skipped ${res.skipped_duplicates} duplicates).`,
      });
      void healthQuery.refetch();
    } catch (err) {
      addToast({
        tone: 'error',
        title: 'Import Failed',
        message: err instanceof Error ? err.message : 'Invalid JSON file.',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearArtworkCache = async () => {
    if (!window.confirm('Clear all cached artwork files? Images will be re-downloaded on demand.')) {
      return;
    }
    try {
      const res = await clearCacheMutation.mutateAsync();
      clearArtworkBlobCache();
      addToast({
        tone: 'success',
        title: 'Cache Cleared',
        message: `Freed ${res.formatted_size} (${res.cleared_files} files removed).`,
      });
      void cacheQuery.refetch();
    } catch {
      addToast({ tone: 'error', title: 'Cache Clear Failed', message: 'Could not clear cache.' });
    }
  };

  const handleSaveCredentials = async () => {
    if (!igdbClientId && !igdbClientSecret && !steamGridDbKey) {
      addToast({
        tone: 'warning',
        title: 'Credentials required',
        message: 'Provide at least one API credential field to update.',
      });
      return;
    }
    setSavingCreds(true);
    try {
      await systemApi.updateCredentials({
        igdb_client_id: igdbClientId || undefined,
        igdb_client_secret: igdbClientSecret || undefined,
        steamgriddb_api_key: steamGridDbKey || undefined,
      });
      addToast({
        tone: 'success',
        title: 'API Credentials Saved',
        message: 'Saved securely with DPAPI / Windows Credential Manager.',
      });
      setIgdbClientId('');
      setIgdbClientSecret('');
      setSteamGridDbKey('');
      void integrationsQuery.refetch();
    } catch (err: unknown) {
      addToast({
        tone: 'error',
        title: 'Failed to save credentials',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSavingCreds(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-2 pb-24 p-6">
      {/* Page Title */}
      <div>
        <h1 className="font-headline text-headline-xl font-bold text-on-background">Settings</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Customize application behavior, controller profiles, SQLite database backups, and local
          storage.
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-outline/70 pb-3">
        {(
          [
            { id: 'storage', label: 'Storage & Backup', icon: Database },
            { id: 'controller', label: 'Controller', icon: Gamepad2 },
            { id: 'integrations', label: 'Integrations & API', icon: Server },
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'performance', label: 'Performance', icon: Zap },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'about', label: 'About', icon: Info },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-nav-item="true"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-label-md font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-elevated hover:text-on-background'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== STORAGE & BACKUP TAB ==================== */}
      {activeTab === 'storage' && (
        <div className="space-y-6">
          {/* SQLite Online Backup Section */}
          <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-accent-primary" />
                  <h2 className="font-headline text-headline-md font-bold text-on-background">
                    SQLite Online Database Backup
                  </h2>
                </div>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Perform WAL-safe, online point-in-time backups without locking the active database.
                </p>
              </div>

              <Button
                data-nav-item="true"
                variant="primary"
                onClick={handleCreateBackup}
                disabled={createBackupMutation.isPending}
              >
                <Database className="mr-1.5 h-4 w-4" />
                {createBackupMutation.isPending ? 'Backing up...' : 'Create Backup Now'}
              </Button>
            </div>

            {/* Backups Table */}
            <div className="mt-4 overflow-hidden rounded-xl border border-outline/70 bg-surface-dark">
              <table className="w-full text-left text-body-sm">
                <thead className="border-b border-outline/70 bg-surface-darker text-label-sm font-semibold uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Filename</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/50">
                  {isBackupsLoading ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-muted">
                        Loading backup files...
                      </td>
                    </tr>
                  ) : !backups || backups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-on-surface-variant">
                        No database backups found in %APPDATA%/Checkpoint/backups.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.filename} className="hover:bg-surface-elevated/40">
                        <td className="px-4 py-3 font-mono text-body-sm font-semibold text-on-background">
                          {b.filename}
                        </td>
                        <td className="px-4 py-3 font-mono text-on-surface-variant">
                          {b.formatted_size}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          {new Date(b.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            data-nav-item="true"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRestoreBackup(b.filename)}
                            disabled={restoreBackupMutation.isPending}
                          >
                            Restore
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Portable JSON Export & Import Section */}
          <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="font-headline text-headline-md font-bold text-on-background">
                Portable JSON Export & Import
              </h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Export and import your library, backlog rankings, journal logs, and wishlist without
                including sensitive API credentials.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button
                data-nav-item="true"
                variant="secondary"
                onClick={handleExportJson}
                disabled={isExporting}
              >
                <Download className="mr-1.5 h-4 w-4 text-accent-primary" />
                {isExporting ? 'Exporting...' : 'Export Portable Library (JSON)'}
              </Button>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleImportJsonFile}
                  className="hidden"
                />
                <Button
                  data-nav-item="true"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  <Upload className="mr-1.5 h-4 w-4 text-success" />
                  {isImporting ? 'Importing...' : 'Import Library (JSON)'}
                </Button>
              </div>
            </div>
          </section>

          {/* Disk Artwork Cache */}
          <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline text-headline-md font-bold text-on-background">
                  Disk Artwork Cache
                </h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {cacheQuery.data
                    ? `${cacheQuery.data.total_files} cached covers/heroes (${cacheQuery.data.formatted_size})`
                    : 'Disk artwork cache.'}
                </p>
              </div>

              <Button
                data-nav-item="true"
                variant="ghost"
                onClick={handleClearArtworkCache}
                disabled={clearCacheMutation.isPending}
                className="text-error hover:bg-error/10"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Clear Disk Cache
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* ==================== CONTROLLER TAB ==================== */}
      {activeTab === 'controller' && <ControllerSettingsPanel />}

      {/* ==================== INTEGRATIONS TAB ==================== */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline text-headline-md font-bold text-on-background">
                API Credentials & Metadata Integrations
              </h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Credentials are encrypted locally with DPAPI / Windows Credential Manager.
              </p>
            </div>

            <Button
              data-nav-item="true"
              variant="secondary"
              size="sm"
              onClick={() => void integrationsQuery.refetch()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Check Status
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-body-sm">
            <div className="rounded-xl border border-outline/70 bg-surface-dark p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-on-background">IGDB / Twitch</span>
                <Badge tone={integrationsQuery.data?.igdb_connected ? 'success' : 'neutral'} size="sm">
                  {integrationsQuery.data?.igdb_connected ? 'Connected' : 'Not Connected'}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-outline/70 bg-surface-dark p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-on-background">SteamGridDB</span>
                <Badge
                  tone={integrationsQuery.data?.steamgriddb_connected ? 'success' : 'neutral'}
                  size="sm"
                >
                  {integrationsQuery.data?.steamgriddb_connected ? 'Connected' : 'Not Connected'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-outline/60">
            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
                IGDB Client ID
              </label>
              <Input
                data-nav-item="true"
                value={igdbClientId}
                onChange={(e) => setIgdbClientId(e.target.value)}
                placeholder="Twitch Developer Client ID"
              />
            </div>

            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
                IGDB Client Secret
              </label>
              <Input
                data-nav-item="true"
                type="password"
                value={igdbClientSecret}
                onChange={(e) => setIgdbClientSecret(e.target.value)}
                placeholder="Twitch Developer Client Secret"
              />
            </div>

            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
                SteamGridDB API Key
              </label>
              <Input
                data-nav-item="true"
                type="password"
                value={steamGridDbKey}
                onChange={(e) => setSteamGridDbKey(e.target.value)}
                placeholder="SteamGridDB API Key"
              />
            </div>

            <Button
              data-nav-item="true"
              variant="primary"
              onClick={handleSaveCredentials}
              disabled={savingCreds}
            >
              {savingCreds ? 'Saving...' : 'Save Production Credentials'}
            </Button>
          </div>
        </section>

        {/* Steam Account Integration Section (Phase 6A) */}
        <SteamConnectSection />
      </div>
      )}

      {/* ==================== APPEARANCE TAB ==================== */}
      {activeTab === 'appearance' && (
        <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-5">
          <h2 className="font-headline text-headline-md font-bold text-on-background">
            Appearance & Visual Design
          </h2>

          <div className="space-y-4">
            <div className="rounded-xl border border-outline/70 bg-surface-dark p-4">
              <span className="font-semibold text-on-background">Visual Design System</span>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Built on Google Stitch project <code>16645222145573679933</code> (CHECKPOINT V2).
                Atmospheric dark surfaces (#111722–#2B384B), Sora & Inter typography, and dynamic
                game-specific color scrims.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ==================== PERFORMANCE TAB ==================== */}
      {activeTab === 'performance' && (
        <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-5">
          <h2 className="font-headline text-headline-md font-bold text-on-background">
            Performance & Accessibility
          </h2>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background">
              <Checkbox
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
              />
              <div>
                <span className="font-semibold">Reduced Motion</span>
                <p className="text-body-sm text-on-surface-variant">
                  Disable complex cinematic backdrop zooms and spring physics for lower GPU usage.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background">
              <Checkbox
                checked={sidebarCollapsed}
                onChange={(e) => setSidebarCollapsed(e.target.checked)}
              />
              <div>
                <span className="font-semibold">Compact Sidebar Mode</span>
                <p className="text-body-sm text-on-surface-variant">
                  Keep navigation sidebar condensed to maximize game cover grid space.
                </p>
              </div>
            </label>
          </div>
        </section>
      )}

      {/* ==================== NOTIFICATIONS TAB ==================== */}
      {activeTab === 'notifications' && (
        <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-5">
          <h2 className="font-headline text-headline-md font-bold text-on-background">
            Session Reminders & Alerts
          </h2>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background">
              <Checkbox
                checked={sessionReminders}
                onChange={(e) => setSessionReminders(e.target.checked)}
              />
              <div>
                <span className="font-semibold">Enable Gaming Planner Reminders</span>
                <p className="text-body-sm text-on-surface-variant">
                  Show in-app notification toasts before scheduled sessions begin.
                </p>
              </div>
            </label>

            <div className="flex items-start gap-2.5 rounded-xl border border-outline/60 bg-surface-dark p-3 text-caption text-on-surface-variant">
              <Info className="h-4 w-4 shrink-0 text-accent-primary mt-0.5" />
              <span>
                Desktop Application Lifecycle Notice: CHECKPOINT is a private local-first app
                without cloud accounts or background Windows services. Reminders trigger while the
                application is open or minimized to the system tray.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ==================== ABOUT TAB ==================== */}
      {activeTab === 'about' && (
        <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-4">
          <h2 className="font-headline text-headline-md font-bold text-on-background">
            About CHECKPOINT Gaming Hub
          </h2>

          <div className="space-y-2 text-body-sm text-on-surface-variant">
            <p>
              <strong>Version:</strong> 0.5.0 (Phase 5: Complete Gaming Management)
            </p>
            <p>
              <strong>Platform:</strong> Windows Desktop (Tauri 2.0 + React + FastAPI + SQLite)
            </p>
            <p>
              <strong>Design System:</strong> CHECKPOINT V2 (Google Stitch)
            </p>
            <p>
              <strong>Architecture:</strong> 100% Local-First. Zero telemetry.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
