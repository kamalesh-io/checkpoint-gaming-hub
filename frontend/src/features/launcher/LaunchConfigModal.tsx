import { useState } from 'react';
import {
  Gamepad2,
  Minimize2,
  Play,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  useLaunchConfigQuery,
  useSetLaunchConfigMutation,
} from '@/hooks/queries/usePhase6Queries';
import { launcherApi } from '@/services/launcherApi';
import { useToastStore } from '@/stores/toastStore';
import type { LaunchConfigResponse } from '@/types';

interface LaunchConfigModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  gameTitle: string;
  onLaunchSuccess?: () => void;
}

function LaunchConfigForm({
  config,
  gameId,
  gameTitle,
  onClose,
  onLaunchSuccess,
}: {
  config?: LaunchConfigResponse;
  gameId: string;
  gameTitle: string;
  onClose: () => void;
  onLaunchSuccess?: () => void;
}) {
  const setConfigMutation = useSetLaunchConfigMutation(gameId);
  const addToast = useToastStore((s) => s.addToast);

  const [executablePath, setExecutablePath] = useState(config?.executable_path || '');
  const [launchArgs, setLaunchArgs] = useState(config?.launch_arguments || '');
  const [minimizeOnLaunch, setMinimizeOnLaunch] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);

  const handleSave = async () => {
    try {
      await setConfigMutation.mutateAsync({
        executable_path: executablePath.trim() || null,
        launch_arguments: launchArgs.trim() || null,
      });
      addToast({
        title: 'Launch Configuration Saved',
        description: 'Successfully updated game launch parameters.',
        tone: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Invalid configuration.',
        tone: 'error',
      });
    }
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      // 1. If custom executable is configured, launch it
      if (executablePath.trim()) {
        const argsList = launchArgs.trim() ? launchArgs.trim().split(/\s+/) : undefined;
        await launcherApi.launchExecutable(executablePath.trim(), argsList, minimizeOnLaunch);
        addToast({
          title: `Launching ${gameTitle}`,
          description: 'Game process started.',
          tone: 'success',
        });
      } else if (config?.steam_app_id) {
        // 2. Launch via Steam URI
        await launcherApi.launchSteamGame(config.steam_app_id, minimizeOnLaunch);
        addToast({
          title: `Launching ${gameTitle}`,
          description: 'Invoking Steam URI protocol...',
          tone: 'success',
        });
      } else {
        throw new Error('No valid launch configuration configured for this game.');
      }

      onLaunchSuccess?.();
      onClose();
    } catch (err) {
      addToast({
        title: 'Launch Failed',
        description: err instanceof Error ? err.message : 'Could not launch game.',
        tone: 'error',
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const canLaunch = Boolean(executablePath.trim() || config?.steam_app_id);

  return (
    <div className="space-y-6 pt-2">
      {/* Launch Mode Card */}
      <div className="rounded-xl border border-outline/70 bg-surface-darker/70 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-body-sm font-semibold text-on-background flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-accent-primary" />
            Detected Launch Target
          </span>
          {config?.steam_app_id ? (
            <Badge tone="accent" size="sm">
              Steam App #{config.steam_app_id}
            </Badge>
          ) : config?.executable_path ? (
            <Badge tone="success" size="sm">
              Custom Executable
            </Badge>
          ) : (
            <Badge tone="warning" size="sm">
              Unconfigured
            </Badge>
          )}
        </div>

        <p className="text-body-sm text-muted">
          {config?.steam_app_id
            ? `This title will launch via Steam using verified URI protocol: steam://run/${config.steam_app_id}.`
            : 'Specify a verified local Windows executable (.exe) to enable one-click launch.'}
        </p>

        {config?.is_installed && (
          <div className="flex items-center gap-2 text-xs text-accent-primary font-medium">
            <ShieldCheck className="h-4 w-4" />
            Detected locally installed on this PC
          </div>
        )}
      </div>

      {/* Custom Executable Path */}
      <div className="space-y-2">
        <label className="text-body-sm font-medium text-on-background flex items-center justify-between">
          <span>Executable Path (.exe)</span>
          <span className="text-xs text-muted">Binary only • Shell scripts forbidden</span>
        </label>
        <Input
          value={executablePath}
          onChange={(e) => setExecutablePath(e.target.value)}
          placeholder="C:\Games\ExampleGame\game.exe"
          data-nav-item="true"
        />
      </div>

      {/* Launch Arguments */}
      <div className="space-y-2">
        <label className="text-body-sm font-medium text-on-background flex items-center justify-between">
          <span>Optional Launch Arguments</span>
          <span className="text-xs text-muted">e.g. -dx11 -windowed</span>
        </label>
        <Input
          value={launchArgs}
          onChange={(e) => setLaunchArgs(e.target.value)}
          placeholder="-novid -fullscreen"
          data-nav-item="true"
        />
      </div>

      {/* Focus & Minimization Behavior */}
      <div className="flex items-center justify-between rounded-xl border border-outline/50 bg-surface-darker/40 p-3.5">
        <div className="flex items-center gap-2.5">
          <Minimize2 className="h-4 w-4 text-muted" />
          <div>
            <p className="text-body-sm font-medium text-on-background">
              Minimize CHECKPOINT on launch
            </p>
            <p className="text-xs text-muted">
              Reduces background GPU & RAM usage while gaming
            </p>
          </div>
        </div>
        <input
          type="checkbox"
          checked={minimizeOnLaunch}
          onChange={(e) => setMinimizeOnLaunch(e.target.checked)}
          className="h-5 w-5 rounded accent-accent-primary cursor-pointer"
          data-nav-item="true"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/50">
        <Button variant="secondary" onClick={onClose} data-nav-item="true">
          Cancel
        </Button>
        <Button
          variant="secondary"
          leftIcon={<Save className="h-4 w-4" />}
          onClick={handleSave}
          disabled={setConfigMutation.isPending}
          data-nav-item="true"
        >
          Save Config
        </Button>
        <Button
          variant="accent"
          leftIcon={<Play className="h-4 w-4" />}
          onClick={handleLaunch}
          disabled={!canLaunch || isLaunching}
          data-nav-item="true"
        >
          {isLaunching ? 'Starting...' : 'Play Game'}
        </Button>
      </div>
    </div>
  );
}

export function LaunchConfigModal({
  open,
  onClose,
  gameId,
  gameTitle,
  onLaunchSuccess,
}: LaunchConfigModalProps) {
  const { data: config } = useLaunchConfigQuery(gameId);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`Play Game — ${gameTitle}`}
      subtitle="Configure game executable, launch options, and desktop focus behavior."
      size="md"
    >
      <LaunchConfigForm
        key={`${gameId}-${config?.executable_path ?? 'empty'}`}
        config={config}
        gameId={gameId}
        gameTitle={gameTitle}
        onClose={onClose}
        onLaunchSuccess={onLaunchSuccess}
      />
    </Modal>
  );
}
