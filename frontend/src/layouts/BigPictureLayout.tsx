import { useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Gamepad2, Keyboard, Monitor } from 'lucide-react';
import { CheckpointLogo } from '@/components/branding/CheckpointLogo';
import { ControllerGlyphLegend, type GlyphLegendItem } from '@/components/controller/ControllerGlyphLegend';
import { BackendGate } from '@/components/layout/BackendGate';
import { CinematicBackdrop } from '@/components/game/CinematicBackdrop';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { ActiveSessionHUD } from '@/features/sessions/ActiveSessionHUD';
import { useHealthQuery, useLibraryQuery } from '@/hooks/queries';
import { CONTROLLER_CUSTOM_EVENT } from '@/hooks/useSpatialNavigation';
import { ROUTES } from '@/routes/routes';
import { isTauriRuntime } from '@/services/api';
import type { ControllerActionEvent } from '@/services/gamepad/types';
import { useAppStore } from '@/stores/appStore';
import { useControllerStore } from '@/stores/controllerStore';
import { cn } from '@/utils/cn';

const BP_NAV_ITEMS = [
  { to: ROUTES.BIG_PICTURE, label: 'Home', end: true },
  { to: `${ROUTES.BIG_PICTURE}/library`, label: 'Library', end: false },
  { to: `${ROUTES.BIG_PICTURE}/discover`, label: 'Discover', end: false },
  { to: `${ROUTES.BIG_PICTURE}/backlog`, label: 'Backlog', end: false },
  { to: `${ROUTES.BIG_PICTURE}/planner`, label: 'Planner', end: false },
  { to: `${ROUTES.BIG_PICTURE}/collections`, label: 'Collections', end: false },
  { to: `${ROUTES.BIG_PICTURE}/wishlist`, label: 'Wishlist', end: false },
  { to: `${ROUTES.BIG_PICTURE}/settings`, label: 'Settings', end: false },
] as const;

/**
 * Fullscreen 10-foot living-room console layout matching Stitch V2 Big Picture (node_11731173976490379291).
 */
export function BigPictureLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const setFullscreen = useAppStore((s) => s.setFullscreen);
  const connectedControllers = useControllerStore((s) => s.connectedControllers);
  const activeControllerName = useControllerStore((s) => s.activeControllerName);
  const activeControllerProfile = useControllerStore((s) => s.activeControllerProfile);
  const activeEntryId = useControllerStore((s) => s.bigPictureActiveEntryId);

  const healthQuery = useHealthQuery();
  const backendOnline = Boolean(healthQuery.data && !healthQuery.isError);
  const libraryQuery = useLibraryQuery({ limit: 100 }, backendOnline);
  const entries = useMemo(() => libraryQuery.data?.data ?? [], [libraryQuery.data]);

  const activeEntry = useMemo(() => {
    if (entries.length === 0) return null;
    if (activeEntryId) {
      const hit = entries.find((e) => e.id === activeEntryId);
      if (hit) return hit;
    }
    return (
      entries.find((e) => e.playing_status === 'Currently Playing') ??
      entries.find((e) => e.playing_status === 'Planned') ??
      entries[0] ??
      null
    );
  }, [entries, activeEntryId]);

  const rawBackdropUrl =
    activeEntry?.artwork?.hero_url ??
    activeEntry?.artwork?.cover_url ??
    activeEntry?.game.artworks.find((a) => a.asset_type === 'hero')?.remote_url ??
    null;

  // Enter borderless fullscreen when Big Picture mounts, restore gracefully on Desktop Mode exit
  useEffect(() => {
    let mounted = true;
    const enterFullscreen = async () => {
      if (isTauriRuntime()) {
        try {
          const win = getCurrentWindow();
          if (!(await win.isFullscreen())) {
            await win.setFullscreen(true);
            if (mounted) setFullscreen(true);
          }
        } catch {
          // ignore
        }
      }
    };
    void enterFullscreen();
    return () => {
      mounted = false;
    };
  }, [setFullscreen]);

  const handleExitToDesktop = async () => {
    if (isTauriRuntime()) {
      try {
        const win = getCurrentWindow();
        if (await win.isFullscreen()) {
          await win.setFullscreen(false);
          setFullscreen(false);
        }
      } catch {
        // ignore
      }
    } else if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      setFullscreen(false);
    }
    navigate(ROUTES.OVERVIEW);
  };

  // Top console tab LB/RB switching when no modal or inner sub-tabs capture it
  useEffect(() => {
    const onAction = (ev: Event) => {
      const detail = (ev as CustomEvent<ControllerActionEvent>).detail;
      if (!detail) return;
      if (document.querySelector('[aria-modal="true"]')) return;

      if (detail.action === 'PREVIOUS_TAB' || detail.action === 'NEXT_TAB') {
        const idx = BP_NAV_ITEMS.findIndex((item) =>
          item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
        );
        const safeIdx = idx >= 0 ? idx : 0;
        const nextIdx =
          detail.action === 'NEXT_TAB'
            ? (safeIdx + 1) % BP_NAV_ITEMS.length
            : (safeIdx - 1 + BP_NAV_ITEMS.length) % BP_NAV_ITEMS.length;
        const target = BP_NAV_ITEMS[nextIdx];
        if (target && !location.pathname.includes('/games/')) {
          ev.preventDefault();
          navigate(target.to);
        }
      }
    };
    window.addEventListener(CONTROLLER_CUSTOM_EVENT, onAction);
    return () => window.removeEventListener(CONTROLLER_CUSTOM_EVENT, onAction);
  }, [location.pathname, navigate]);

  const isGameDetails = location.pathname.includes('/big-picture/games/');
  const isHome = location.pathname === ROUTES.BIG_PICTURE;
  const isLibrary = location.pathname === `${ROUTES.BIG_PICTURE}/library`;
  const isDiscover = location.pathname === `${ROUTES.BIG_PICTURE}/discover`;

  const legendItems: GlyphLegendItem[] = useMemo(() => {
    if (isHome) {
      return [
        { button: 'CONFIRM', label: 'Open Game' },
        { button: 'QUICK_ACTION', label: 'Progress' },
        { button: 'SEARCH', label: 'Discover' },
        { button: 'RB', label: 'Next Section' },
        { button: 'BACK', label: 'Desktop' },
      ];
    }
    if (isLibrary) {
      return [
        { button: 'CONFIRM', label: 'Open Game' },
        { button: 'QUICK_ACTION', label: 'Quick Actions' },
        { button: 'SEARCH', label: 'Discover' },
        { button: 'RB', label: 'Next Section' },
        { button: 'BACK', label: 'Back' },
      ];
    }
    if (isDiscover) {
      return [
        { button: 'CONFIRM', label: 'Select / Type' },
        { button: 'QUICK_ACTION', label: 'Add to Wishlist' },
        { button: 'SEARCH', label: 'Open Keyboard' },
        { button: 'BACK', label: 'Back' },
      ];
    }
    if (isGameDetails) {
      return [
        { button: 'CONFIRM', label: 'Select' },
        { button: 'QUICK_ACTION', label: 'Update Progress' },
        { button: 'LB', label: 'Prev Tab' },
        { button: 'RB', label: 'Next Tab' },
        { button: 'BACK', label: 'Back' },
      ];
    }
    return [
      { button: 'CONFIRM', label: 'Select' },
      { button: 'LB', label: 'Prev Section' },
      { button: 'RB', label: 'Next Section' },
      { button: 'BACK', label: 'Back' },
    ];
  }, [isHome, isLibrary, isDiscover, isGameDetails]);

  const connectionLabel =
    connectedControllers.length > 0
      ? activeControllerProfile === 'playstation'
        ? 'DualSense Connected'
        : activeControllerProfile === 'xbox'
          ? 'Xbox Controller Connected'
          : `${activeControllerName ?? 'Controller'} Connected`
      : 'Keyboard & Mouse Ready';

  return (
    <div className="relative flex h-screen w-screen flex-col justify-between overflow-hidden bg-background text-on-background font-body select-none">
      {/* Shared Cinematic Atmospheric Backdrop (preserves previous frame until decoded) */}
      <CinematicBackdrop
        rawArtworkUrl={rawBackdropUrl}
        gameId={activeEntry?.game_id ?? null}
        gameTitle={activeEntry?.game.title ?? null}
        backendAccentToken={activeEntry?.active_accent ?? null}
        syncAccent={!isGameDetails}
      />

      {/* Overscan-Safe Minimal Console Top Bar (Stitch node_11731173976490379291) */}
      <header className="relative z-20 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 px-6 sm:px-10 xl:px-14 pt-5 pb-2.5 shrink-0">
        <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 min-w-0 flex-1">
          <CheckpointLogo size="sm" showWordmark showSubtitle={false} className="shrink-0" />

          <nav
            aria-label="Big Picture Navigation"
            data-nav-group="bp-topnav"
            className="flex items-center gap-2 sm:gap-4 lg:gap-6 font-headline text-body-sm sm:text-body-md lg:text-headline-sm min-w-0 overflow-x-auto no-scrollbar"
          >
            {BP_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-nav-item="true"
                data-nav-group="bp-topnav"
                className={({ isActive }) =>
                  cn(
                    'pb-1.5 transition-all duration-state-change border-b-2 whitespace-nowrap',
                    isActive
                      ? 'text-on-background border-accent-active font-semibold'
                      : 'text-muted border-transparent hover:text-on-background',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Honest Hardware Connection Indicator — only green/connected when real controller detected */}
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-outline/70 bg-secondary-background/80 backdrop-blur-md px-3 py-1 text-[12px] whitespace-nowrap">
            {connectedControllers.length > 0 ? (
              <>
                <Gamepad2 className="h-3.5 w-3.5 text-success shrink-0" aria-hidden="true" />
                <span className="text-on-background font-medium">{connectionLabel}</span>
              </>
            ) : (
              <>
                <Keyboard className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden="true" />
                <span className="text-muted">No Controller Connected</span>
              </>
            )}
          </div>

          <button
            type="button"
            data-nav-item="true"
            data-nav-group="bp-topnav"
            onClick={() => void handleExitToDesktop()}
            className="inline-flex items-center gap-2 rounded-xl border border-outline/75 bg-surface-elevated/90 px-3.5 py-1.5 font-label text-label-md text-on-surface hover:bg-accent-active hover:text-on-accent-active hover:border-transparent transition-colors whitespace-nowrap"
          >
            <Monitor className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Desktop Mode</span>
          </button>
        </div>
      </header>

      {/* Main Overscan-Safe Console Viewport */}
      <main
        id="checkpoint-main-viewport"
        className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-6 sm:px-10 xl:px-14 py-3"
      >
        <BackendGate isSettingsRoute={location.pathname.endsWith('/settings')}>
          <Outlet />
        </BackendGate>
      </main>

      {/* Permanent Contextual Console Footer Bar */}
      <footer className="relative z-20 border-t border-outline/50 bg-background/65 backdrop-blur-md px-6 sm:px-10 xl:px-14 py-2.5 shrink-0">
        <ControllerGlyphLegend items={legendItems} />
      </footer>

      <ActiveSessionHUD />
      <ToastViewport />
    </div>
  );
}
