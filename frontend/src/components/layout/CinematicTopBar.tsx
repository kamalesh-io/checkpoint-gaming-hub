import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  ArrowUpCircle,
  Bell,
  Copy,
  Gamepad2,
  Maximize2,
  Minimize2,
  Minus,
  Settings,
  Square,
  Terminal,
  X,
} from 'lucide-react';
import { CheckpointLogo } from '@/components/branding/CheckpointLogo';
import { GlobalSearchAutocomplete } from '@/components/layout/GlobalSearchAutocomplete';
import { NotificationDropdown } from '@/components/layout/NotificationDropdown';
import { IconButton } from '@/components/ui/IconButton';
import { ROUTES } from '@/routes/routes';
import { soundManager } from '@/audio/soundManager';
import { isTauriRuntime } from '@/services/api';
import { useAppStore } from '@/stores/appStore';
import { useControllerStore } from '@/stores/controllerStore';
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { cn } from '@/utils/cn';

export interface CinematicTopBarProps {
  backendOnline?: boolean;
}

/**
 * CHECKPOINT V3 Cinematic Top Bar — translucent, blends with game background.
 * Left: Emblem + "CHECKPOINT GAMING HUB"
 * Center: Global search with Ctrl+K
 * Right: Controller indicator, notifications, settings gear, window controls
 */
export function CinematicTopBar({ backendOnline = true }: CinematicTopBarProps) {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

  const globalSearchQuery = useAppStore((s) => s.globalSearchQuery);
  const setGlobalSearchQuery = useAppStore((s) => s.setGlobalSearchQuery);
  const isFullscreen = useAppStore((s) => s.isFullscreen);
  const setFullscreen = useAppStore((s) => s.setFullscreen);

  const connectedControllers = useControllerStore((s) => s.connectedControllers);
  const gamepadConnected = connectedControllers.length > 0;
  const { hasUpdate, availableVersion, openDialog } = useAppUpdater();

  const [isMaximized, setIsMaximized] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const inTauri = isTauriRuntime();

  // Global Ctrl+K shortcut focuses search bar from anywhere
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Track native Tauri maximize/fullscreen state
  useEffect(() => {
    if (!inTauri) return;
    let unlisten: (() => void) | undefined;

    const syncWindowState = async () => {
      try {
        const win = getCurrentWindow();
        setIsMaximized(await win.isMaximized());
        setFullscreen(await win.isFullscreen());
        unlisten = await win.onResized(async () => {
          try {
            setIsMaximized(await win.isMaximized());
            setFullscreen(await win.isFullscreen());
          } catch {
            // ignore transient resize errors
          }
        });
      } catch {
        // non-Tauri preview fallback
      }
    };

    void syncWindowState();
    return () => {
      unlisten?.();
    };
  }, [inTauri, setFullscreen]);

  const handleSearchSubmit = (finalQuery: string) => {
    const trimmed = finalQuery.trim();
    if (!trimmed) {
      navigate(ROUTES.DISCOVER);
      return;
    }
    navigate(`${ROUTES.DISCOVER}?q=${encodeURIComponent(trimmed)}`);
  };

  const handleMinimize = async () => {
    if (!inTauri) return;
    await getCurrentWindow().minimize();
  };

  const handleToggleMaximize = async () => {
    if (!inTauri) return;
    const win = getCurrentWindow();
    await win.toggleMaximize();
    setIsMaximized(await win.isMaximized());
  };

  const handleToggleFullscreen = async () => {
    if (inTauri) {
      const win = getCurrentWindow();
      const next = !(await win.isFullscreen());
      await win.setFullscreen(next);
      setFullscreen(next);
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
      setFullscreen(false);
    } else {
      await document.documentElement.requestFullscreen().catch(() => undefined);
      setFullscreen(true);
    }
  };

  const handleClose = async () => {
    if (!inTauri) return;
    await getCurrentWindow().close();
  };

  return (
    <header
      data-tauri-drag-region
      className={cn(
        'fixed top-0 left-0 right-0 z-40 select-none',
        'h-14 px-5 flex items-center justify-between gap-4',
        'bg-[#0C0F12]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-md transition-all',
      )}
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-3 min-w-0 shrink-0" data-tauri-drag-region>
        <CheckpointLogo size="sm" showWordmark showSubtitle={false} />
      </div>

      {/* Center: Global Search */}
      <div className="flex-1 max-w-lg min-w-[180px]">
        <GlobalSearchAutocomplete
          searchRef={searchRef}
          query={globalSearchQuery}
          onQueryChange={setGlobalSearchQuery}
          onSubmit={handleSearchSubmit}
        />
      </div>

      {/* Right: Utility Controls */}
      <div className="flex items-center gap-1.5 shrink-0" data-tauri-drag-region>
        {/* Backend & Controller status indicator matching reference */}
        <div
          className={cn(
            'hidden md:flex items-center gap-1.5 rounded-full px-2.5 py-1',
            'text-[11px] font-medium',
            gamepadConnected ? 'text-on-surface' : 'text-muted/60',
          )}
          title={backendOnline ? 'Checkpoint Services Connected' : 'Offline / Reconnecting'}
        >
          <Gamepad2 className="h-4 w-4" />
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              backendOnline ? 'bg-success shadow-[0_0_8px_#52D6A0]' : 'bg-warning',
            )}
          />
        </div>

        {/* Update Available Pill */}
        {hasUpdate && (
          <button
            type="button"
            data-nav-item="true"
            onClick={() => {
              soundManager.playClick();
              openDialog();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all animate-pulse"
            title={`Update v${availableVersion} available`}
          >
            <ArrowUpCircle className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">v{availableVersion}</span>
          </button>
        )}

        <div className="relative">
          <IconButton
            ref={notificationButtonRef}
            label="Notifications"
            size="sm"
            variant="ghost"
            onClick={() => {
              soundManager.playClick();
              setIsNotificationsOpen((prev) => !prev);
            }}
            className={cn(
              'relative text-muted hover:text-on-background',
              isNotificationsOpen && 'text-on-background bg-surface-elevated',
            )}
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent-active ring-2 ring-[#0C0F12]" />
          </IconButton>

          <NotificationDropdown
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            triggerRef={notificationButtonRef}
          />
        </div>

        <IconButton
          label="System Logs"
          size="sm"
          variant="ghost"
          onClick={() => {
            soundManager.playClick();
            navigate(ROUTES.LOGS);
          }}
          className="text-muted hover:text-on-background"
        >
          <Terminal className="h-4 w-4" />
        </IconButton>

        <IconButton
          label="Settings"
          size="sm"
          variant="ghost"
          onClick={() => navigate(ROUTES.SETTINGS)}
          className="text-muted hover:text-on-background"
        >
          <Settings className="h-4 w-4" />
        </IconButton>

        <IconButton
          label={isFullscreen ? 'Exit Fullscreen (F11)' : 'Enter Fullscreen (F11)'}
          size="sm"
          variant="ghost"
          onClick={() => void handleToggleFullscreen()}
          className="text-muted hover:text-on-background"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </IconButton>

        {inTauri && (
          <div className="flex items-center border-l border-outline/50 pl-1.5 ml-0.5 gap-0.5">
            <IconButton label="Minimize Window" size="sm" variant="ghost" onClick={() => void handleMinimize()}>
              <Minus className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              size="sm"
              variant="ghost"
              onClick={() => void handleToggleMaximize()}
            >
              {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            </IconButton>
            <IconButton
              label="Close Application"
              size="sm"
              variant="danger"
              onClick={() => void handleClose()}
              className="border-transparent bg-transparent"
            >
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        )}
      </div>
    </header>
  );
}
