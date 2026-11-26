import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import {
  extractAccentFromArtwork,
  KNOWN_ACCENT_PALETTES,
  resolveKnownGameAccent,
} from '@/utils/theme';

interface UseGameThemeSyncOptions {
  gameId?: string | null;
  title?: string | null;
  backendAccentToken?: string | null;
  resolvedArtworkSrc?: string | null;
  enabled?: boolean;
}

/**
 * Synchronizes the global CHECKPOINT dynamic accent theme (--accent-active CSS vars)
 * to match the currently selected or inspected game.
 */
export function useGameThemeSync({
  gameId = null,
  title = null,
  backendAccentToken = null,
  resolvedArtworkSrc = null,
  enabled = true,
}: UseGameThemeSyncOptions): void {
  const setPalette = useThemeStore((state) => state.setPalette);

  useEffect(() => {
    if (!enabled) return;

    if (!title && !gameId) {
      setPalette(KNOWN_ACCENT_PALETTES.primary!, null, null);
      return;
    }

    const known = resolveKnownGameAccent(title, backendAccentToken);
    if (known) {
      setPalette(known, gameId, title);
      return;
    }

    let cancelled = false;
    if (resolvedArtworkSrc) {
      void extractAccentFromArtwork(resolvedArtworkSrc).then((extracted) => {
        if (!cancelled) {
          setPalette(extracted, gameId, title);
        }
      });
    } else {
      setPalette(KNOWN_ACCENT_PALETTES.primary!, gameId, title);
    }

    return () => {
      cancelled = true;
    };
  }, [enabled, gameId, title, backendAccentToken, resolvedArtworkSrc, setPalette]);
}
