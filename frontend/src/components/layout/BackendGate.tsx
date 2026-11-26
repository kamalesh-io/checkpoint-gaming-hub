import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { StartupScreen } from '@/features/startup/StartupScreen';
import {
  useBackendStatusQuery,
  useHealthQuery,
  useIntegrationsQuery,
} from '@/hooks/queries';
import {
  apiClient,
  CheckpointApiError,
  isTauriRuntime,
  restartTauriBackend,
} from '@/services/api';
import { useToastStore } from '@/stores/toastStore';

export type BackendConnectionState =
  | 'connecting'
  | 'online'
  | 'unavailable'
  | 'invalid_auth'
  | 'external_provider_error';

export interface BackendGateProps {
  children: ReactNode;
  allowBypassOnSettings?: boolean;
  isSettingsRoute?: boolean;
}

export function BackendGate({
  children,
  allowBypassOnSettings = true,
  isSettingsRoute = false,
}: BackendGateProps) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const healthQuery = useHealthQuery();
  const healthOk = Boolean(healthQuery.data && !healthQuery.isError);
  const authStatusQuery = useBackendStatusQuery(healthOk);
  const integrationsQuery = useIntegrationsQuery(
    healthOk && !authStatusQuery.isError,
  );

  const [tokenInput, setTokenInput] = useState('');
  const [providerBannerDismissed, setProviderBannerDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const handleRestartBackend = async () => {
    setRestarting(true);
    try {
      if (isTauriRuntime()) {
        const config = await restartTauriBackend();
        if (config?.baseUrl) {
          apiClient.updateConfig(config.baseUrl, config.token);
        }
      }
      handleRetryAll();
      addToast({
        type: 'info',
        title: 'Backend Restarted',
        description: 'Local services have re-initialized.',
      });
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Restart Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setRestarting(false);
    }
  };

  const isAuthError =
    authStatusQuery.error instanceof CheckpointApiError &&
    authStatusQuery.error.isAuthError;

  const isUnavailable =
    healthQuery.isError ||
    (authStatusQuery.isError && !isAuthError &&
      authStatusQuery.error instanceof CheckpointApiError &&
      authStatusQuery.error.isNetworkError);

  const connectionState: BackendConnectionState = isAuthError
    ? 'invalid_auth'
    : isUnavailable
      ? 'unavailable'
      : healthQuery.isLoading || (healthOk && authStatusQuery.isLoading)
        ? 'connecting'
        : integrationsQuery.data &&
            (!integrationsQuery.data.igdb_connected ||
              !integrationsQuery.data.steamgriddb_connected)
          ? 'external_provider_error'
          : 'online';

  const handleRetryAll = () => {
    void healthQuery.refetch();
    void authStatusQuery.refetch();
    void integrationsQuery.refetch();
  };

  const handleApplyToken = () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      addToast({
        type: 'warning',
        title: 'Token required',
        description: 'Enter the runtime X-Checkpoint-Token printed by your local backend.',
      });
      return;
    }
    apiClient.setAuthToken(trimmed, true);
    setTokenInput('');
    void queryClient.invalidateQueries();
    addToast({
      type: 'success',
      title: 'Authentication token applied',
      description: 'Reconnecting to local CHECKPOINT backend...',
    });
  };

  if (connectionState === 'invalid_auth' && !(allowBypassOnSettings && isSettingsRoute)) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <div className="rounded-2xl border border-warning/40 bg-secondary-background/90 p-7 shadow-modal space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 border border-warning/35 text-warning">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-headline text-headline-md text-on-background">
                Local Session Authentication Required
              </h2>
              <p className="text-body-sm text-muted mt-1 leading-relaxed">
                The CHECKPOINT backend on <code className="text-on-surface">{apiClient.getBaseUrl()}</code>{' '}
                rejected the handshake header (HTTP 401). Paste your runtime{' '}
                <code className="text-on-surface">X-Checkpoint-Token</code> to continue.
              </p>
            </div>
          </div>

          <Input
            label="Runtime X-Checkpoint-Token"
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApplyToken();
            }}
            leftAdornment={<KeyRound className="h-4 w-4" />}
            placeholder="Paste token from sidecar / developer environment"
          />

          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={handleRetryAll}
            >
              Retry Connection
            </Button>
            <Button variant="accent" onClick={handleApplyToken}>
              Unlock Local Session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (connectionState === 'connecting' && !healthQuery.data) {
    return <StartupScreen onReady={handleRetryAll} />;
  }

  if (connectionState === 'unavailable' && !(allowBypassOnSettings && isSettingsRoute)) {
    return (
      <div className="mx-auto max-w-2xl py-10 space-y-4">
        <ErrorState
          variant="offline"
          title="Local CHECKPOINT Backend Offline"
          message={`Unable to reach the local SQLite & metadata server at ${apiClient.getBaseUrl()}. Reconnect or restart local services.`}
          onRetry={handleRetryAll}
          retryLabel="Reconnect Now"
        />
        {isTauriRuntime() && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              leftIcon={<RefreshCw className={`h-4 w-4 ${restarting ? 'animate-spin' : ''}`} />}
              isLoading={restarting}
              onClick={() => void handleRestartBackend()}
            >
              Restart Backend Process
            </Button>
          </div>
        )}
        <div className="rounded-xl border border-outline/70 bg-secondary-background/60 px-5 py-3.5 text-body-sm text-muted flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-muted shrink-0" />
            All imported games remain safely stored in your local SQLite database.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {connectionState === 'external_provider_error' && !providerBannerDismissed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/35 bg-warning/10 px-4 py-2.5 text-body-sm">
          <p className="text-on-surface">
            <span className="font-semibold text-warning">Offline / External Provider Notice:</span>{' '}
            Your local library works 100% offline, while external IGDB or SteamGridDB connectivity is
            currently degraded.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void integrationsQuery.refetch()}
            >
              Recheck
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setProviderBannerDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
