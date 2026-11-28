import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AccentToken } from '@/types';

export interface AppFoundationState {
  activeAccent: AccentToken;
  isFullscreen: boolean;
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
  globalSearchQuery: string;
  dynamicAccentEnabled: boolean;
  defaultAccent: AccentToken;
  minimizeOnLaunch: boolean;
  lowGpuMode: boolean;
  sessionRemindersEnabled: boolean;
  priceAlertsEnabled: boolean;
  achievementAlertsEnabled: boolean;

  setActiveAccent: (accent: AccentToken) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setReducedMotion: (reduced: boolean) => void;
  setGlobalSearchQuery: (query: string) => void;
  setDynamicAccentEnabled: (enabled: boolean) => void;
  setDefaultAccent: (accent: AccentToken) => void;
  setMinimizeOnLaunch: (minimize: boolean) => void;
  setLowGpuMode: (enabled: boolean) => void;
  setSessionRemindersEnabled: (enabled: boolean) => void;
  setPriceAlertsEnabled: (enabled: boolean) => void;
  setAchievementAlertsEnabled: (enabled: boolean) => void;
}

export const useAppStore = create<AppFoundationState>()(
  persist(
    (set) => ({
      activeAccent: 'primary',
      isFullscreen: false,
      sidebarCollapsed: false,
      reducedMotion: false,
      globalSearchQuery: '',
      dynamicAccentEnabled: true,
      defaultAccent: 'primary',
      minimizeOnLaunch: true,
      lowGpuMode: false,
      sessionRemindersEnabled: true,
      priceAlertsEnabled: true,
      achievementAlertsEnabled: true,

      setActiveAccent: (accent) => set({ activeAccent: accent }),
      setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
      setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
      setDynamicAccentEnabled: (enabled) => set({ dynamicAccentEnabled: enabled }),
      setDefaultAccent: (accent) => set({ defaultAccent: accent }),
      setMinimizeOnLaunch: (minimize) => set({ minimizeOnLaunch: minimize }),
      setLowGpuMode: (enabled) => set({ lowGpuMode: enabled }),
      setSessionRemindersEnabled: (enabled) => set({ sessionRemindersEnabled: enabled }),
      setPriceAlertsEnabled: (enabled) => set({ priceAlertsEnabled: enabled }),
      setAchievementAlertsEnabled: (enabled) => set({ achievementAlertsEnabled: enabled }),
    }),
    {
      name: 'checkpoint-app-preferences',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        reducedMotion: state.reducedMotion,
        dynamicAccentEnabled: state.dynamicAccentEnabled,
        defaultAccent: state.defaultAccent,
        minimizeOnLaunch: state.minimizeOnLaunch,
        lowGpuMode: state.lowGpuMode,
        sessionRemindersEnabled: state.sessionRemindersEnabled,
        priceAlertsEnabled: state.priceAlertsEnabled,
        achievementAlertsEnabled: state.achievementAlertsEnabled,
      }),
    },
  ),
);
