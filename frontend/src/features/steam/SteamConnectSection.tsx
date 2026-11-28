import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DownloadCloud,
  ExternalLink,
  Link2,
  RefreshCw,
  Shield,
  Unlink,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useSteamConnectMutation,
  useSteamDisconnectMutation,
  useSteamStatusQuery,
  useSteamTestMutation,
} from '@/hooks/queries/usePhase6Queries';
import { useToastStore } from '@/stores/toastStore';
import { formatShortDate } from '@/utils/format';
import { openExternalUrl } from '@/utils/browser';
import { SteamImportModal } from './SteamImportModal';

export function SteamConnectSection() {
  const { data: status, isLoading } = useSteamStatusQuery();
  const connectMutation = useSteamConnectMutation();
  const disconnectMutation = useSteamDisconnectMutation();
  const testMutation = useSteamTestMutation();
  const addToast = useToastStore((s) => s.addToast);

  const [identifier, setIdentifier] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    warning?: string | null;
  } | null>(null);

  const handleTest = async () => {
    if (!identifier.trim()) {
      addToast({
        title: 'Missing Identifier',
        description: 'Please enter a SteamID64 or Steam profile URL.',
        tone: 'error',
      });
      return;
    }
    try {
      const res = await testMutation.mutateAsync({
        steam_id_64: identifier.trim(),
        api_key: apiKey.trim() || null,
      });
      setTestResult({
        success: res.success,
        message: res.message,
        warning: res.privacy_warning,
      });
      if (res.success) {
        addToast({
          title: 'Connection Successful',
          description: res.message,
          tone: 'success',
        });
      } else {
        addToast({
          title: 'Connection Test Failed',
          description: res.message,
          tone: 'error',
        });
      }
    } catch (err) {
      addToast({
        title: 'Test Failed',
        description: err instanceof Error ? err.message : 'Failed to reach Steam API.',
        tone: 'error',
      });
    }
  };

  const handleConnect = async () => {
    if (!identifier.trim()) return;
    try {
      await connectMutation.mutateAsync({
        steam_id_64: identifier.trim(),
        api_key: apiKey.trim() || null,
        auto_sync_enabled: false,
        sync_interval_hours: 24,
      });
      addToast({
        title: 'Steam Account Connected',
        description: 'Account credentials encrypted securely via Windows DPAPI.',
        tone: 'success',
      });
      setTestResult(null);
    } catch (err) {
      addToast({
        title: 'Connection Failed',
        description: err instanceof Error ? err.message : 'Could not link Steam account.',
        tone: 'error',
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectMutation.mutateAsync();
      addToast({
        title: 'Steam Account Disconnected',
        description: 'Your personal library and gaming history remain intact.',
        tone: 'neutral',
      });
    } catch {
      addToast({
        title: 'Disconnect Failed',
        description: 'Could not disconnect account.',
        tone: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 rounded-2xl border border-outline/75 bg-secondary-background/80 p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-outline/75 bg-secondary-background/80 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-headline text-headline-md text-on-background flex items-center gap-2.5">
            <Link2 className="h-5 w-5 text-accent-primary" />
            Steam Account Integration
          </h3>
          <p className="text-body-sm text-muted">
            Connect your Steam account for one-click library imports, playtime sync, and achievements.
          </p>
        </div>

        {status?.is_connected && (
          <Badge tone={status.is_private ? 'warning' : 'success'} size="md">
            {status.is_private ? 'Connected (Private Profile)' : 'Connected'}
          </Badge>
        )}
      </div>

      {status?.is_connected ? (
        /* Connected State Card */
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-outline/70 bg-surface-darker/70 p-5">
            <div className="flex items-center gap-4">
              {status.avatar_url ? (
                <img
                  src={status.avatar_url}
                  alt={status.persona_name || 'Steam User'}
                  className="h-14 w-14 rounded-xl object-cover border border-outline/80 shadow-sm"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-dark border border-outline/80 text-muted">
                  <User className="h-7 w-7" />
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-headline text-body-lg font-bold text-on-background">
                    {status.persona_name || 'Steam User'}
                  </h4>
                  {status.profile_url && (
                    <button
                      type="button"
                      onClick={() => void openExternalUrl(status.profile_url!)}
                      className="text-muted hover:text-on-background transition-colors cursor-pointer bg-transparent border-0 p-0"
                      title="Open Steam Profile"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted font-mono">
                  SteamID64: {status.steam_id_64}
                </p>
                {status.last_synced_at && (
                  <p className="text-xs text-muted">
                    Last Synced: {formatShortDate(status.last_synced_at)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="accent"
                size="sm"
                leftIcon={<DownloadCloud className="h-4 w-4" />}
                onClick={() => setImportModalOpen(true)}
                data-nav-item="true"
              >
                Sync Steam Library
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Unlink className="h-4 w-4" />}
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
                data-nav-item="true"
              >
                Disconnect
              </Button>
            </div>
          </div>

          {status.privacy_warning && (
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-warning">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1 text-body-sm">
                <p className="font-semibold">Privacy Restriction Detected</p>
                <p className="text-on-background/80 text-xs">
                  {status.privacy_warning}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Disconnected / Connect Form */
        <div className="space-y-4">
          <div className="rounded-xl border border-outline/60 bg-surface-darker/50 p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-body-sm font-medium text-on-background">
                  SteamID64 or Steam Profile URL
                </label>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. 76561198000000000 or steamcommunity.com/id/name"
                  data-nav-item="true"
                />
              </div>

              <div className="space-y-2">
                <label className="text-body-sm font-medium text-on-background flex items-center justify-between">
                  <span>Steam Web API Key</span>
                  <button
                    type="button"
                    onClick={() => void openExternalUrl('https://steamcommunity.com/dev/apikey')}
                    className="text-xs text-accent-primary hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                  >
                    Get API Key <ExternalLink className="h-3 w-3" />
                  </button>
                </label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="32-character hexadecimal key"
                  data-nav-item="true"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted">
              <Shield className="h-3.5 w-3.5 text-accent-primary" />
              <span>
                API keys are encrypted locally using Windows DPAPI. Never commit or share your key.
              </span>
            </div>

            {testResult && (
              <div
                className={`rounded-xl border p-4 text-xs ${
                  testResult.success
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-danger/40 bg-danger/10 text-danger'
                }`}
              >
                <p className="font-semibold">{testResult.message}</p>
                {testResult.warning && (
                  <p className="mt-1 text-on-background/80">{testResult.warning}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={handleTest}
                disabled={testMutation.isPending || !identifier.trim()}
                data-nav-item="true"
              >
                {testMutation.isPending ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button
                variant="accent"
                size="sm"
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                onClick={handleConnect}
                disabled={connectMutation.isPending || !identifier.trim()}
                data-nav-item="true"
              >
                {connectMutation.isPending ? 'Connecting...' : 'Connect Steam Account'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Steam Library Sync Modal */}
      <SteamImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </section>
  );
}
