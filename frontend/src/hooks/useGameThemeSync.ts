import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
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
 * to match the currently selected or inspected game when dynamic accents are enabled,
 * or adheres strictly to user's configured default accent when disabled.
 */
export function useGameThemeSync({
  gameId = null,
  title = null,
  backendAccentToken = null,
  resolvedArtworkSrc = null,
  enabled = true,
}: UseGameThemeSyncOptions): void {
  const setPalette = useThemeStore((state) => state.setPalette);
  const dynamicAccentEnabled = useAppStore((state) => state.dynamicAccentEnabled);
  const defaultAccent = useAppStore((state) => state.defaultAccent);

  useEffect(() => {
    if (!enabled) return;

    // When dynamic game accent is disabled, lock to user-chosen default theme palette
    if (!dynamicAccentEnabled) {
      const fixed = KNOWN_ACCENT_PALETTES[defaultAccent] || KNOWN_ACCENT_PALETTES.primary!;
      setPalette(fixed, gameId, title);
      return;
    }

    if (!title && !gameId) {
      const fallback = KNOWN_ACCENT_PALETTES[defaultAccent] || KNOWN_ACCENT_PALETTES.primary!;
      setPalette(fallback, null, null);
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
      const fallback = KNOWN_ACCENT_PALETTES[defaultAccent] || KNOWN_ACCENT_PALETTES.primary!;
      setPalette(fallback, gameId, title);
    }

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    dynamicAccentEnabled,
    defaultAccent,
    gameId,
    title,
    backendAccentToken,
    resolvedArtworkSrc,
    setPalette,
  ]);
}
