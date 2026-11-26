import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AccentToken } from '@/types';

export interface AppFoundationState {
  activeAccent: AccentToken;
  isFullscreen: boolean;
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
  globalSearchQuery: string;
  setActiveAccent: (accent: AccentToken) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setReducedMotion: (reduced: boolean) => void;
  setGlobalSearchQuery: (query: string) => void;
}

export const useAppStore = create<AppFoundationState>()(
  persist(
    (set) => ({
      activeAccent: 'primary',
      isFullscreen: false,
      sidebarCollapsed: false,
      reducedMotion: false,
      globalSearchQuery: '',
      setActiveAccent: (accent) => set({ activeAccent: accent }),
      setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
      setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
    }),
    {
      name: 'checkpoint-app-preferences',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        reducedMotion: state.reducedMotion,
      }),
    },
  ),
);
