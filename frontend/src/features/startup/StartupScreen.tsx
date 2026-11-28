import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { CheckpointLogo } from '@/components/branding/CheckpointLogo';
import { Button } from '@/components/ui/Button';
import {
  apiClient,
  getTauriBackendStatus,
  isTauriRuntime,
  restartTauriBackend,
} from '@/services/api';
import { systemApi } from '@/services/systemApi';
import { useAppStore } from '@/stores/appStore';

export interface StartupScreenProps {
  onReady?: () => void;
}

export type StartupStage =
  | 'initializing'
  | 'starting_services'
  | 'preparing_library'
  | 'ready'
  | 'error';

const STAGE_LABELS: Record<StartupStage, string> = {
  initializing: 'Initializing Checkpoint',
  starting_services: 'Starting local game services',
  preparing_library: 'Preparing your library',
  ready: 'Ready',
  error: 'Backend Initialization Failed',
};

export const StartupScreen: React.FC<StartupScreenProps> = ({ onReady }) => {
  const prefersReducedMotion = useReducedMotion();
  const isFullscreen = useAppStore((state) => state.isFullscreen);
  const setFullscreen = useAppStore((state) => state.setFullscreen);

  const [stage, setStage] = useState<StartupStage>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function probeBackend() {
      // 1. Initializing
      setStage('initializing');
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;

      // 2. Starting services
      setStage('starting_services');

      // Initialize session token & base URL if Tauri is available
      await apiClient.initializeSession();
      if (cancelled) return;

      // Poll until backend is healthy or timeout (up to 35 seconds to allow PyInstaller extraction)
      const startTime = Date.now();
      let isHealthy = false;

      while (!cancelled && Date.now() - startTime < 35000) {
        try {
          if (isTauriRuntime()) {
            const tauriStatus = await getTauriBackendStatus();
            if (tauriStatus?.status === 'error') {
              setStage('error');
              setErrorMessage(tauriStatus.message || 'Local backend service encountered an error.');
              return;
            }
          }

          const health = await systemApi.checkHealth();
          if (health?.status === 'healthy') {
            isHealthy = true;
            break;
          }
        } catch {
          // Retry probe after delay
        }
        await new Promise((r) => setTimeout(r, 600));
      }

      if (cancelled) return;

      if (!isHealthy) {
        setStage('error');
        setErrorMessage(
          'Unable to establish handshake with local CHECKPOINT services on 127.0.0.1.',
        );
        return;
      }

      // 3. Preparing library
      setStage('preparing_library');
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;

      // 4. Ready
      setStage('ready');
      await new Promise((r) => setTimeout(r, 350));
      if (cancelled) return;

      onReady?.();
    }

    void probeBackend();

    return () => {
      cancelled = true;
    };
  }, [onReady]);

  const handleRetry = async () => {
    setRetrying(true);
    setErrorMessage(null);
    setStage('initializing');

    try {
      if (isTauriRuntime()) {
        const newConfig = await restartTauriBackend();
        if (newConfig?.baseUrl) {
          apiClient.updateConfig(newConfig.baseUrl, newConfig.token);
        }
      }

      // Wait a moment then probe health
      await new Promise((r) => setTimeout(r, 1000));
      const health = await systemApi.checkHealth();
      if (health?.status === 'healthy') {
        setStage('preparing_library');
        await new Promise((r) => setTimeout(r, 500));
        setStage('ready');
        await new Promise((r) => setTimeout(r, 300));
        onReady?.();
        return;
      }
      throw new Error('Health probe did not report healthy status');
    } catch (err: unknown) {
      setStage('error');
      const msg =
        typeof err === 'string'
          ? err
          : err instanceof Error
            ? err.message
            : 'Failed to restart local game services. Please retry.';
      setErrorMessage(msg);
    } finally {
      setRetrying(false);
    }
  };

  const handleToggleFullscreen = async () => {
    if (isTauriRuntime()) {
      try {
        const win = getCurrentWindow();
        const current = await win.isFullscreen();
        await win.setFullscreen(!current);
        setFullscreen(!current);
      } catch (err) {
        console.warn('Unable to toggle fullscreen:', err);
      }
      return;
    }

    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
      setFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => undefined);
      setFullscreen(false);
    }
  };

  return (
    <main className="relative flex-1 min-h-screen w-full bg-background flex flex-col items-center justify-center overflow-hidden px-xl select-none">
      {/* Subtle CHECKPOINT V3 atmospheric ambient radial gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(102,184,255,0.12)_0%,_rgba(12,15,18,0)_68%)]"
      />

      {/* Startup Centerpiece */}
      <motion.section
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center text-center gap-8 max-w-md w-full"
      >
        <CheckpointLogo size="lg" showWordmark showSubtitle />

        {/* Initialization Status Box */}
        <div className="w-full flex flex-col items-center gap-4">
          <div className="w-full rounded-2xl bg-surface/80 border border-outline/70 p-5 shadow-card flex flex-col items-center gap-3">
            {stage === 'error' ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-10 h-10 rounded-full bg-error/15 border border-error/30 flex items-center justify-center text-error">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline text-headline-sm text-on-surface">
                    {STAGE_LABELS.error}
                  </h3>
                  <p className="font-body text-body-sm text-muted mt-1 max-w-xs">
                    {errorMessage || 'Unable to start local gaming services.'}
                  </p>
                </div>
                <Button
                  variant="accent"
                  size="md"
                  data-nav-item="true"
                  leftIcon={<RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />}
                  isLoading={retrying}
                  onClick={() => void handleRetry()}
                >
                  Retry Connection
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="flex items-center gap-2.5">
                  {stage === 'ready' ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  )}
                  <span className="font-label text-label-md text-on-surface font-medium">
                    {STAGE_LABELS[stage]}
                  </span>
                </div>

                {/* Step indicator pills */}
                <div className="flex items-center gap-1.5 w-full max-w-xs justify-center pt-1">
                  {(['initializing', 'starting_services', 'preparing_library', 'ready'] as const).map(
                    (s, idx) => {
                      const stages = ['initializing', 'starting_services', 'preparing_library', 'ready'];
                      const currentIdx = stages.indexOf(stage);
                      const isComplete = currentIdx >= idx;
                      const isCurrent = currentIdx === idx;

                      return (
                        <div
                          key={s}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            isCurrent
                              ? 'bg-primary shadow-[0_0_8px_rgba(102,184,255,0.6)]'
                              : isComplete
                                ? 'bg-primary/50'
                                : 'bg-surface-elevated border border-outline/50'
                          }`}
                        />
                      );
                    },
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            data-nav-item="true"
            onClick={() => void handleToggleFullscreen()}
            className="inline-flex items-center gap-sm px-md py-xs rounded-sm text-muted hover:text-on-surface hover:bg-surface-elevated transition-colors duration-state-change ease-state-change focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-label text-label-sm"
            aria-label={isFullscreen ? 'Exit Fullscreen (F11)' : 'Enter Fullscreen (F11)'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)'}</span>
          </button>
        </div>
      </motion.section>
    </main>
  );
};
