import { create } from 'zustand';
import {
  applyCssAccentVariables,
  KNOWN_ACCENT_PALETTES,
  type ResolvedAccentPalette,
} from '@/utils/theme';

interface ThemeState {
  palette: ResolvedAccentPalette;
  activeGameId: string | null;
  activeGameTitle: string | null;
  setPalette: (palette: ResolvedAccentPalette, gameId?: string | null, title?: string | null) => void;
  resetTheme: () => void;
}

const DEFAULT_PALETTE = KNOWN_ACCENT_PALETTES.primary!;

export const useThemeStore = create<ThemeState>((set) => ({
  palette: DEFAULT_PALETTE,
  activeGameId: null,
  activeGameTitle: null,
  setPalette: (palette, gameId = null, title = null) => {
    applyCssAccentVariables(palette);
    set({ palette, activeGameId: gameId, activeGameTitle: title });
  },
  resetTheme: () => {
    applyCssAccentVariables(DEFAULT_PALETTE);
    set({ palette: DEFAULT_PALETTE, activeGameId: null, activeGameTitle: null });
  },
}));
