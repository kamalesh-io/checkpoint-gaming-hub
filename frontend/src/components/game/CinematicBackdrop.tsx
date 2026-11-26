import { useState } from 'react';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { useGameThemeSync } from '@/hooks/useGameThemeSync';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/utils/cn';

export interface CinematicBackdropProps {
  rawArtworkUrl: string | null | undefined;
  gameId?: string | null;
  gameTitle?: string | null;
  backendAccentToken?: string | null;
  syncAccent?: boolean;
  className?: string;
}

/**
 * Shared atmospheric game backdrop engine for both Desktop Hero and Big Picture Mode.
 * Preloads incoming artwork over the previous settled frame before crossfading (600ms)
 * to prevent flashes-to-black and synchronizes dynamic CSS accent variables.
 */
export function CinematicBackdrop({
  rawArtworkUrl,
  gameId = null,
  gameTitle = null,
  backendAccentToken = null,
  syncAccent = true,
  className,
}: CinematicBackdropProps) {
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const { resolvedSrc } = useAuthenticatedImage(rawArtworkUrl);

  useGameThemeSync({
    gameId,
    title: gameTitle,
    backendAccentToken,
    resolvedArtworkSrc: resolvedSrc,
    enabled: syncAccent,
  });

  const [settledBg, setSettledBg] = useState<string | null>(null);

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {/* Previous settled frame stays visible until incoming artwork finishes decoding */}
      {settledBg && settledBg !== resolvedSrc && (
        <img
          src={settledBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      )}

      {resolvedSrc ? (
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          alt=""
          aria-hidden="true"
          decoding="async"
          onLoad={() => setSettledBg(resolvedSrc)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover object-center',
            settledBg === resolvedSrc ? 'opacity-100' : 'opacity-0',
            !reducedMotion &&
              'transition-opacity duration-[650ms] ease-hero-transition scale-[1.02]',
          )}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 75% 25%, rgba(var(--accent-active-rgb), 0.24), transparent 58%), linear-gradient(135deg, #1B2636 0%, #111722 100%)',
          }}
        />
      )}

      {/* Dual-direction CHECKPOINT V2 atmospheric gradient scrims */}
      <div className="absolute inset-0 checkpoint-hero-scrim-x" />
      <div className="absolute inset-0 checkpoint-hero-scrim-y" />

      {/* Dynamic Accent Ambient Glow */}
      <div
        aria-hidden="true"
        className="absolute -bottom-24 -left-16 h-80 w-[28rem] rounded-full blur-3xl opacity-25 transition-colors duration-500"
        style={{ backgroundColor: 'var(--accent-active)' }}
      />
    </div>
  );
}
