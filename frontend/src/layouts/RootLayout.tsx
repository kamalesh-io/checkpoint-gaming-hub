import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { BackendGate } from '@/components/layout/BackendGate';
import { Sidebar } from '@/components/layout/Sidebar';
import { TitleBar } from '@/components/layout/TitleBar';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { FirstRunOnboardingModal } from '@/features/onboarding/FirstRunOnboardingModal';
import { ActiveSessionHUD } from '@/features/sessions/ActiveSessionHUD';
import { ActiveSessionRecoveryModal } from '@/features/sessions/ActiveSessionRecoveryModal';
import { useHealthQuery, useLibraryQuery } from '@/hooks/queries';
import { ROUTES } from '@/routes/routes';
import { apiClient, isTauriRuntime } from '@/services/api';
import { useAppStore } from '@/stores/appStore';

export function RootLayout() {
  const location = useLocation();
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const setFullscreen = useAppStore((s) => s.setFullscreen);

  const healthQuery = useHealthQuery();
  const backendOnline = Boolean(healthQuery.data && !healthQuery.isError);

  const libraryQuery = useLibraryQuery({ limit: 100 }, backendOnline);
  const allEntries = libraryQuery.data?.data ?? [];
  const libraryCount = libraryQuery.data?.meta.total;
  const wishlistCount = allEntries.filter(
    (entry) => entry.ownership_status === 'To Buy',
  ).length;

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
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('checkpoint_onboarding_completed');
  });

  const handleCloseOnboarding = () => {
    localStorage.setItem('checkpoint_onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-background font-body">
      <Sidebar libraryCount={libraryCount} wishlistCount={wishlistCount} />

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <TitleBar backendOnline={backendOnline} />

        <main
          id="checkpoint-main-viewport"
          className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-6 sm:px-7 lg:px-9"
        >
          <div className="mx-auto w-full max-w-[1600px]">
            <BackendGate isSettingsRoute={isSettingsRoute}>
              <Outlet />
            </BackendGate>
          </div>
        </main>
      </div>

      <ActiveSessionHUD />
      <ActiveSessionRecoveryModal />
      <FirstRunOnboardingModal
        open={showOnboarding}
        onClose={handleCloseOnboarding}
      />
      <ToastViewport />
    </div>
  );
}
