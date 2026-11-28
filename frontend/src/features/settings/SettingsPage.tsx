import { useState, useRef, type ChangeEvent } from 'react';
import {
  Bell,
  Check,
  Database,
  Download,
  ExternalLink,
  Gamepad2,
  Info,
  Loader2,
  Palette,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
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
import { useThemeStore } from '@/stores/themeStore';
import { useToastStore } from '@/stores/toastStore';
import {
  ACCENT_COLOR_OPTIONS,
  KNOWN_ACCENT_PALETTES,
} from '@/utils/theme';
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
  const dynamicAccentEnabled = useAppStore((s) => s.dynamicAccentEnabled);
  const setDynamicAccentEnabled = useAppStore((s) => s.setDynamicAccentEnabled);
  const defaultAccent = useAppStore((s) => s.defaultAccent);
  const setDefaultAccent = useAppStore((s) => s.setDefaultAccent);
  const minimizeOnLaunch = useAppStore((s) => s.minimizeOnLaunch);
  const setMinimizeOnLaunch = useAppStore((s) => s.setMinimizeOnLaunch);
  const lowGpuMode = useAppStore((s) => s.lowGpuMode);
  const setLowGpuMode = useAppStore((s) => s.setLowGpuMode);
  const sessionRemindersEnabled = useAppStore((s) => s.sessionRemindersEnabled);
  const setSessionRemindersEnabled = useAppStore((s) => s.setSessionRemindersEnabled);
  const priceAlertsEnabled = useAppStore((s) => s.priceAlertsEnabled);
  const setPriceAlertsEnabled = useAppStore((s) => s.setPriceAlertsEnabled);
  const achievementAlertsEnabled = useAppStore((s) => s.achievementAlertsEnabled);
  const setAchievementAlertsEnabled = useAppStore((s) => s.setAchievementAlertsEnabled);

  const setPalette = useThemeStore((s) => s.setPalette);
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
  const [steamWebApiKey, setSteamWebApiKey] = useState('');
  const [itadApiKey, setItadApiKey] = useState('');

  const [testingService, setTestingService] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { status: string; message: string; latency?: number | null }>
  >({});

  const [savingCreds, setSavingCreds] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  const handleTestService = async (service: 'igdb' | 'steamgriddb' | 'itad') => {
    setTestingService(service);
    try {
      const res = await systemApi.testServiceConnection({
        service,
        client_id: service === 'igdb' ? (igdbClientId.trim() || undefined) : undefined,
        client_secret: service === 'igdb' ? (igdbClientSecret.trim() || undefined) : undefined,
        api_key:
          service === 'steamgriddb'
            ? (steamGridDbKey.trim() || undefined)
            : service === 'itad'
            ? (itadApiKey.trim() || undefined)
            : undefined,
      });
      setTestResults((prev) => ({
        ...prev,
        [service]: {
          status: res.status,
          message: res.message,
          latency: res.latency_ms,
        },
      }));
      if (res.status === 'connected') {
        addToast({
          tone: 'success',
          title: `${res.service.toUpperCase()} Connected`,
          message: `${res.message}${res.latency_ms ? ` (${res.latency_ms}ms)` : ''}`,
        });
      } else {
        addToast({
          tone: 'error',
          title: `${res.service.toUpperCase()} Verification Failed`,
          message: res.message,
        });
      }
      void integrationsQuery.refetch();
    } catch (err) {
      addToast({
        tone: 'error',
        title: 'Connection Test Failed',
        message: err instanceof Error ? err.message : 'Unknown error occurred.',
      });
    } finally {
      setTestingService(null);
    }
  };

  const handleSaveCredentials = async () => {
    if (!igdbClientId && !igdbClientSecret && !steamGridDbKey && !steamWebApiKey && !itadApiKey) {
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
        igdb_client_id: igdbClientId.trim() || undefined,
        igdb_client_secret: igdbClientSecret.trim() || undefined,
        steamgriddb_api_key: steamGridDbKey.trim() || undefined,
        steam_web_api_key: steamWebApiKey.trim() || undefined,
        itad_api_key: itadApiKey.trim() || undefined,
      });
      addToast({
        tone: 'success',
        title: 'API Credentials Saved',
        message: 'Saved securely with DPAPI / Windows Credential Manager.',
      });
      setIgdbClientId('');
      setIgdbClientSecret('');
      setSteamGridDbKey('');
      setSteamWebApiKey('');
      setItadApiKey('');
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-accent-primary" />
                  <h2 className="font-headline text-headline-md font-bold text-on-background">
                    API Credentials & Metadata Integrations
                  </h2>
                </div>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Credentials are encrypted on-device with Windows DPAPI. Checkpoint never shares or uploads your keys.
                </p>
              </div>

              <Button
                data-nav-item="true"
                variant="secondary"
                size="sm"
                onClick={() => void integrationsQuery.refetch()}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Refresh Status
              </Button>
            </div>

            {/* Service 1: IGDB (Required) */}
            <div className="rounded-xl border border-outline/70 bg-surface-dark p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-body-md text-on-background">IGDB / Twitch</span>
                  <Badge tone="accent" size="sm">Required</Badge>
                  <Badge
                    tone={integrationsQuery.data?.igdb_connected ? 'success' : 'neutral'}
                    size="sm"
                  >
                    {integrationsQuery.data?.igdb_connected ? 'Connected' : 'Not Configured'}
                  </Badge>
                </div>
                <a
                  href="https://dev.twitch.tv/console"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-caption text-accent-primary hover:underline"
                >
                  <span>Get Twitch Credentials</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-body-sm text-on-surface-variant">
                Powers real-time game search, release dates, genres, screenshots, and aggregate critic scores.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
                    Twitch Client ID
                  </label>
                  <Input
                    data-nav-item="true"
                    value={igdbClientId}
                    onChange={(e) => setIgdbClientId(e.target.value)}
                    placeholder="Enter Client ID"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
                    Twitch Client Secret
                  </label>
                  <Input
                    data-nav-item="true"
                    type="password"
                    value={igdbClientSecret}
                    onChange={(e) => setIgdbClientSecret(e.target.value)}
                    placeholder="Enter Client Secret"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {testResults.igdb ? (
                  <span className={`text-caption font-medium ${testResults.igdb.status === 'connected' ? 'text-success' : 'text-error'}`}>
                    {testResults.igdb.message} {testResults.igdb.latency ? `(${testResults.igdb.latency}ms)` : ''}
                  </span>
                ) : <span />}

                <Button
                  data-nav-item="true"
                  variant="secondary"
                  size="sm"
                  disabled={testingService === 'igdb'}
                  onClick={() => handleTestService('igdb')}
                >
                  {testingService === 'igdb' ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Testing IGDB...
                    </>
                  ) : (
                    'Test IGDB Connection'
                  )}
                </Button>
              </div>
            </div>

            {/* Service 2: SteamGridDB (Optional) */}
            <div className="rounded-xl border border-outline/70 bg-surface-dark p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-body-md text-on-background">SteamGridDB</span>
                  <Badge tone="neutral" size="sm">Optional</Badge>
                  <Badge
                    tone={integrationsQuery.data?.steamgriddb_connected ? 'success' : 'neutral'}
                    size="sm"
                  >
                    {integrationsQuery.data?.steamgriddb_connected ? 'Connected' : 'Not Configured'}
                  </Badge>
                </div>
                <a
                  href="https://www.steamgriddb.com/profile/preferences/api"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-caption text-accent-primary hover:underline"
                >
                  <span>Get SteamGridDB Key</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-body-sm text-on-surface-variant">
                Enables high-resolution vertical 600x900 game covers, transparent hero logos, and wide banner artwork customization.
              </p>

              <div>
                <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
                  SteamGridDB API Key
                </label>
                <Input
                  data-nav-item="true"
                  type="password"
                  value={steamGridDbKey}
                  onChange={(e) => setSteamGridDbKey(e.target.value)}
                  placeholder="Enter SteamGridDB API Key"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {testResults.steamgriddb ? (
                  <span className={`text-caption font-medium ${testResults.steamgriddb.status === 'connected' ? 'text-success' : 'text-error'}`}>
                    {testResults.steamgriddb.message} {testResults.steamgriddb.latency ? `(${testResults.steamgriddb.latency}ms)` : ''}
                  </span>
                ) : <span />}

                <Button
                  data-nav-item="true"
                  variant="secondary"
                  size="sm"
                  disabled={testingService === 'steamgriddb'}
                  onClick={() => handleTestService('steamgriddb')}
                >
                  {testingService === 'steamgriddb' ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Testing SteamGridDB...
                    </>
                  ) : (
                    'Test SteamGridDB Connection'
                  )}
                </Button>
              </div>
            </div>

            {/* Service 3: IsThereAnyDeal (Optional) */}
            <div className="rounded-xl border border-outline/70 bg-surface-dark p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-body-md text-on-background">IsThereAnyDeal (ITAD)</span>
                  <Badge tone="neutral" size="sm">Optional</Badge>
                  <Badge
                    tone={integrationsQuery.data?.itad_connected ? 'success' : 'neutral'}
                    size="sm"
                  >
                    {integrationsQuery.data?.itad_connected ? 'Connected' : 'Not Configured'}
                  </Badge>
                </div>
                <a
                  href="https://isthereanydeal.com/waitlist/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-caption text-accent-primary hover:underline"
                >
                  <span>Get ITAD Key</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-body-sm text-on-surface-variant">
                Enables global storefront price comparisons and historical lows. If unconfigured, Checkpoint seamlessly queries Valve's official Indian regional store API for verified INR (₹) prices.
              </p>

              <div>
                <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
                  IsThereAnyDeal API Key
                </label>
                <Input
                  data-nav-item="true"
                  type="password"
                  value={itadApiKey}
                  onChange={(e) => setItadApiKey(e.target.value)}
                  placeholder="Enter ITAD API Key (Optional)"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {testResults.itad ? (
                  <span className={`text-caption font-medium ${testResults.itad.status === 'connected' ? 'text-success' : 'text-error'}`}>
                    {testResults.itad.message} {testResults.itad.latency ? `(${testResults.itad.latency}ms)` : ''}
                  </span>
                ) : <span />}

                <Button
                  data-nav-item="true"
                  variant="secondary"
                  size="sm"
                  disabled={testingService === 'itad'}
                  onClick={() => handleTestService('itad')}
                >
                  {testingService === 'itad' ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Testing ITAD...
                    </>
                  ) : (
                    'Test ITAD Connection'
                  )}
                </Button>
              </div>
            </div>

            {/* Save Button for Credentials */}
            <div className="pt-2 border-t border-outline/60 flex items-center justify-between">
              <span className="text-caption text-on-surface-variant">
                Values will be securely stored in Windows Credential Manager.
              </span>
              <Button
                data-nav-item="true"
                variant="primary"
                onClick={handleSaveCredentials}
                disabled={savingCreds}
              >
                {savingCreds ? 'Encrypting & Saving...' : 'Save Production Credentials'}
              </Button>
            </div>
          </section>

          {/* Steam Account Integration Section (Phase 6A) */}
          <SteamConnectSection />
        </div>
      )}

      {/* ==================== APPEARANCE TAB ==================== */}
      {activeTab === 'appearance' && (
        <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="font-headline text-headline-md font-bold text-on-background">
              Appearance & Theme Customization
            </h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Fine-tune Checkpoint's visual identity, dynamic game-driven accent scrims, and default color palette.
            </p>
          </div>

          <div className="space-y-6">
            {/* Dynamic Game Accent Switching */}
            <div className="rounded-xl border border-outline/70 bg-surface-dark p-5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer text-body-md text-on-background">
                <Checkbox
                  checked={dynamicAccentEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setDynamicAccentEnabled(enabled);
                    if (!enabled) {
                      const fallback = KNOWN_ACCENT_PALETTES[defaultAccent] ?? KNOWN_ACCENT_PALETTES.primary!;
                      setPalette(fallback);
                    }
                  }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent-primary" />
                    <span className="font-semibold">Dynamic Game Accent Switching</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">
                    Automatically extract and apply vibrant atmospheric accents from selected game covers and hero artwork across the UI.
                  </p>
                </div>
              </label>
            </div>

            {/* Default Accent Color Palette */}
            <div className="rounded-xl border border-outline/70 bg-surface-dark p-5 space-y-4">
              <div>
                <span className="font-semibold text-body-md text-on-background">
                  Default Accent Palette
                </span>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  Select your signature accent color. Used as the foundation theme and when Dynamic Accent Switching is disabled.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {ACCENT_COLOR_OPTIONS.map((opt) => {
                  const isSelected = defaultAccent === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-nav-item="true"
                      onClick={() => {
                        setDefaultAccent(opt.id);
                        if (!dynamicAccentEnabled) {
                          const pal = KNOWN_ACCENT_PALETTES[opt.id];
                          if (pal) setPalette(pal);
                        }
                      }}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 transition-all text-left ${
                        isSelected
                          ? 'border-accent-primary bg-surface-elevated shadow-sm ring-1 ring-accent-primary'
                          : 'border-outline/70 bg-secondary-background/60 hover:bg-surface-elevated/80'
                      }`}
                    >
                      <span
                        className="h-5 w-5 shrink-0 rounded-full border border-white/20 shadow-sm flex items-center justify-center"
                        style={{ backgroundColor: opt.hex }}
                      >
                        {isSelected && <Check className="h-3 w-3 text-surface-darker stroke-[3]" />}
                      </span>
                      <span className="text-label-sm font-semibold text-on-background truncate">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Design System Details */}
            <div className="rounded-xl border border-outline/70 bg-surface-dark p-5">
              <span className="font-semibold text-on-background">Visual Source of Truth</span>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Built strictly on Google Stitch project <code>16645222145573679933</code> (CHECKPOINT V2).
                Features atmospheric dark surfaces (<code>#111722</code> to <code>#2B384B</code>), Sora & Inter typography, dual-direction gradient scrims, and full-bleed 2:3/16:9 artwork.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ==================== PERFORMANCE TAB ==================== */}
      {activeTab === 'performance' && (
        <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="font-headline text-headline-md font-bold text-on-background">
              Performance & Desktop Behavior
            </h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Configure GPU optimization, background rendering, and window behaviors.
            </p>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface-dark p-4">
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

            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface-dark p-4">
              <Checkbox
                checked={sidebarCollapsed}
                onChange={(e) => setSidebarCollapsed(e.target.checked)}
              />
              <div>
                <span className="font-semibold">Compact Sidebar Mode</span>
                <p className="text-body-sm text-on-surface-variant">
                  Keep navigation sidebar condensed into icon view to maximize game cover grid space.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface-dark p-4">
              <Checkbox
                checked={minimizeOnLaunch}
                onChange={(e) => setMinimizeOnLaunch(e.target.checked)}
              />
              <div>
                <span className="font-semibold">Minimize CHECKPOINT on Game Launch</span>
                <p className="text-body-sm text-on-surface-variant">
                  Automatically minimizes Checkpoint to the taskbar when a game launches, reducing background GPU and RAM overhead.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface-dark p-4">
              <Checkbox
                checked={lowGpuMode}
                onChange={(e) => setLowGpuMode(e.target.checked)}
              />
              <div>
                <span className="font-semibold">Low GPU Background Mode</span>
                <p className="text-body-sm text-on-surface-variant">
                  Pauses ambient hero shaders and canvas animations whenever the CHECKPOINT window loses focus.
                </p>
              </div>
            </label>
          </div>
        </section>
      )}

      {/* ==================== NOTIFICATIONS TAB ==================== */}
      {activeTab === 'notifications' && (
        <section className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="font-headline text-headline-md font-bold text-on-background">
              Desktop Notifications & Alerts
            </h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Manage in-app toast alerts, session reminders, and discount alerts.
            </p>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface-dark p-4">
              <Checkbox
                checked={sessionRemindersEnabled}
                onChange={(e) => setSessionRemindersEnabled(e.target.checked)}
              />
              <div>
                <span className="font-semibold">Enable Gaming Planner Reminders</span>
                <p className="text-body-sm text-on-surface-variant">
                  Show in-app notification toasts before scheduled gaming sessions begin.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface-dark p-4">
              <Checkbox
                checked={priceAlertsEnabled}
                onChange={(e) => setPriceAlertsEnabled(e.target.checked)}
              />
              <div>
                <span className="font-semibold">Enable Wishlist Price & Deal Alerts</span>
                <p className="text-body-sm text-on-surface-variant">
                  Notify when a wishlisted title reaches or drops below your target purchase price.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface-dark p-4">
              <Checkbox
                checked={achievementAlertsEnabled}
                onChange={(e) => setAchievementAlertsEnabled(e.target.checked)}
              />
              <div>
                <span className="font-semibold">Steam Achievement & Milestone Notifications</span>
                <p className="text-body-sm text-on-surface-variant">
                  Display real-time notification toasts when newly unlocked Steam achievements are synced.
                </p>
              </div>
            </label>

            <div className="flex items-start gap-2.5 rounded-xl border border-outline/60 bg-surface-dark p-4 text-caption text-on-surface-variant">
              <Info className="h-4 w-4 shrink-0 text-accent-primary mt-0.5" />
              <span>
                Desktop Application Lifecycle Notice: CHECKPOINT is a private local-first app without cloud accounts or background telemetry. Reminders trigger while the application is running or minimized.
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

          <div className="space-y-3 text-body-sm text-on-surface-variant">
            <div className="rounded-xl border border-outline/70 bg-surface-dark p-4 space-y-2">
              <p>
                <strong className="text-on-background">Version:</strong> 1.0.1 (Windows x64 Release)
              </p>
              <p>
                <strong className="text-on-background">Platform:</strong> Windows 10/11 Desktop (Tauri 2.0 + React 18 + FastAPI + SQLite)
              </p>
              <p>
                <strong className="text-on-background">Design System:</strong> CHECKPOINT V2 (Google Stitch Project <code>16645222145573679933</code>)
              </p>
              <p>
                <strong className="text-on-background">Database:</strong> Local SQLite 3 with Write-Ahead Logging (<code>%APPDATA%/Checkpoint/checkpoint.db</code>)
              </p>
              <p>
                <strong className="text-on-background">Artwork Cache:</strong> <code>%APPDATA%/Checkpoint/artwork/</code>
              </p>
              <p>
                <strong className="text-on-background">Security:</strong> DPAPI / Windows Credential Manager encrypted token storage.
              </p>
              <p>
                <strong className="text-on-background">Architecture:</strong> 100% Local-First. Zero telemetry.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
