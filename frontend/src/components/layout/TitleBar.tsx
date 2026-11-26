import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Square,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SearchInput } from '@/components/ui/SearchInput';
import { ROUTES } from '@/routes/routes';
import { isTauriRuntime } from '@/services/api';
import { useAppStore } from '@/stores/appStore';

export interface TitleBarProps {
  backendOnline?: boolean;
  onQuickAddGame?: () => void;
}

export function TitleBar({ backendOnline = true, onQuickAddGame }: TitleBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);

  const globalSearchQuery = useAppStore((s) => s.globalSearchQuery);
  const setGlobalSearchQuery = useAppStore((s) => s.setGlobalSearchQuery);
  const isFullscreen = useAppStore((s) => s.isFullscreen);
  const setFullscreen = useAppStore((s) => s.setFullscreen);

  const [isMaximized, setIsMaximized] = useState(false);
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = globalSearchQuery.trim();
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

  const routeTitle =
    location.pathname === ROUTES.OVERVIEW
      ? 'Overview'
      : location.pathname === ROUTES.LIBRARY
        ? 'My Library'
        : location.pathname.startsWith('/games/')
          ? 'Game Details'
          : location.pathname.replace('/', '').replace(/-/g, ' ') || 'Checkpoint';

  return (
    <header
      data-tauri-drag-region
      className="h-14 shrink-0 border-b border-outline/70 bg-sidebar/95 backdrop-blur-xl px-4 flex items-center justify-between gap-4 select-none z-30"
    >
      {/* Left: History Navigation & Current Section Indicator */}
      <div className="flex items-center gap-2 min-w-0" data-tauri-drag-region>
        <div className="flex items-center gap-1">
          <IconButton
            label="Go Back"
            size="sm"
            variant="ghost"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Go Forward"
            size="sm"
            variant="ghost"
            onClick={() => navigate(1)}
          >
            <ArrowRight className="h-4 w-4" />
          </IconButton>
        </div>

        <span
          data-tauri-drag-region
          className="hidden md:inline-flex items-center gap-2 rounded-full bg-surface/65 border border-outline/60 px-3 py-1 text-label-sm capitalize text-muted truncate"
        >
          <span
            className={`h-2 w-2 rounded-full ${backendOnline ? 'bg-success' : 'bg-warning'}`}
            title={backendOnline ? 'Local API Connected' : 'Local API Connecting/Offline'}
          />
          <span className="truncate">{routeTitle}</span>
        </span>
      </div>

      {/* Center: Global IGDB/Library Quick Search */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-md min-w-[180px]">
        <SearchInput
          ref={searchRef}
          value={globalSearchQuery}
          onValueChange={setGlobalSearchQuery}
          placeholder="Search IGDB or jump to Discover..."
          shortcutHint="Ctrl+K"
          aria-label="Global game search"
          className="h-9 bg-background/70"
        />
      </form>

      {/* Right: Quick Add & Native Tauri Window Controls */}
      <div className="flex items-center gap-2 shrink-0" data-tauri-drag-region>
        <Button
          variant="accent"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => {
            if (onQuickAddGame) {
              onQuickAddGame();
            } else {
              navigate(ROUTES.DISCOVER);
            }
          }}
          className="hidden sm:inline-flex"
        >
          Add Game
        </Button>

        <IconButton
          label={isFullscreen ? 'Exit Fullscreen (F11)' : 'Enter Fullscreen (F11)'}
          size="sm"
          variant="ghost"
          onClick={() => void handleToggleFullscreen()}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </IconButton>

        {inTauri && (
          <div className="flex items-center border-l border-outline/75 pl-2 ml-1 gap-0.5">
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
