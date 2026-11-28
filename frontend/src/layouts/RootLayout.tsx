import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { BackendGate } from '@/components/layout/BackendGate';
import { CinematicTopBar } from '@/components/layout/CinematicTopBar';
import { FloatingDock } from '@/components/layout/FloatingDock';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { FirstRunOnboardingModal } from '@/features/onboarding/FirstRunOnboardingModal';
import { ActiveSessionHUD } from '@/features/sessions/ActiveSessionHUD';
import { ActiveSessionRecoveryModal } from '@/features/sessions/ActiveSessionRecoveryModal';
import { UpdateDialog } from '@/components/updates/UpdateDialog';
import { WhatsNewModal } from '@/components/updates/WhatsNewModal';
import { useHealthQuery, useWishlistQuery, useLibraryQuery } from '@/hooks/queries';
import { ROUTES } from '@/routes/routes';
import { apiClient, isTauriRuntime } from '@/services/api';
import { useAppStore } from '@/stores/appStore';

export function RootLayout() {
  const location = useLocation();
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const setFullscreen = useAppStore((s) => s.setFullscreen);

  const healthQuery = useHealthQuery();
  const backendOnline = Boolean(healthQuery.data && !healthQuery.isError);

  const dedicatedWishlistQuery = useWishlistQuery({}, backendOnline);
  const legacyWishlistQuery = useLibraryQuery(
    { ownership_status: 'To Buy', limit: 100 },
    backendOnline,
  );

  const wishlistCount =
    (dedicatedWishlistQuery.data?.length ?? 0) +
    (legacyWishlistQuery.data?.data?.length ?? 0);

  useEffect(() => {
    void apiClient.initializeSession();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
  }, [reducedMotion]);

  // Global F11 fullscreen shortcut
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key !== 'F11') return;
      event.preventDefault();

      if (isTauriRuntime()) {
        try {
          const win = getCurrentWindow();
          const next = !(await win.isFullscreen());
          await win.setFullscreen(next);
          setFullscreen(next);
        } catch {
          // ignore
        }
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen().catch(() => undefined);
        setFullscreen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setFullscreen]);

  const isSettingsRoute = location.pathname === ROUTES.SETTINGS;
  const isOverview = location.pathname === ROUTES.OVERVIEW;
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('checkpoint_onboarding_completed');
  });

  const handleCloseOnboarding = () => {
    localStorage.setItem('checkpoint_onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background text-on-background font-body select-none">
      {/* V3 Cinematic Translucent Top Bar */}
      <CinematicTopBar backendOnline={backendOnline} />

      {/* Main Content Area - Full Bleed on Overview, Padded on other screens */}
      <main
        id="checkpoint-main-viewport"
        className={`flex-1 overflow-y-auto overflow-x-hidden ${
          isOverview ? 'pt-0 pb-32' : 'pt-20 pb-32 px-5 sm:px-7 lg:px-9'
        }`}
      >
        <div className={`mx-auto w-full ${isOverview ? 'max-w-none' : 'max-w-[1600px]'}`}>
          <BackendGate isSettingsRoute={isSettingsRoute}>
            <Outlet />
          </BackendGate>
        </div>
      </main>

      {/* V3 Floating Navigation Dock */}
      <FloatingDock wishlistCount={wishlistCount} />

      <ActiveSessionHUD />
      <ActiveSessionRecoveryModal />
      <FirstRunOnboardingModal
        open={showOnboarding}
        onClose={handleCloseOnboarding}
      />
      <UpdateDialog />
      <WhatsNewModal />
      <ToastViewport />
    </div>
  );
}
