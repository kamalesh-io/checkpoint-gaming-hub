import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { cn } from '@/utils/cn';

export type GameArtworkAspect = 'portrait' | 'landscape' | 'square' | 'auto';

export interface GameArtworkProps {
  src: string | null | undefined;
  fallbackSrc?: string | null;
  alt: string;
  aspect?: GameArtworkAspect;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  showTitleOnFallback?: boolean;
  onResolvedSrc?: (resolvedSrc: string | null) => void;
}

const ASPECT_CLASSES: Record<GameArtworkAspect, string> = {
  portrait: 'aspect-[2/3]',
  landscape: 'aspect-[16/9]',
  square: 'aspect-square',
  auto: '',
};

export function GameArtwork({
  src,
  fallbackSrc = null,
  alt,
  aspect = 'portrait',
  className,
  imgClassName,
  eager = false,
  showTitleOnFallback = true,
  onResolvedSrc,
}: GameArtworkProps) {
  const [imgFailedPrimary, setImgFailedPrimary] = useState(false);
  const [imgFailedFallback, setImgFailedFallback] = useState(false);

  const primary = useAuthenticatedImage(src);
  const activeUrl =
    !imgFailedPrimary && primary.resolvedSrc
      ? primary.resolvedSrc
      : fallbackSrc && !imgFailedFallback
        ? fallbackSrc
        : null;

  const fallbackResult = useAuthenticatedImage(
    (!primary.resolvedSrc || imgFailedPrimary || primary.hasError) && fallbackSrc
      ? fallbackSrc
      : null,
  );

  const finalSrc =
    !imgFailedPrimary && primary.resolvedSrc
      ? primary.resolvedSrc
      : !imgFailedFallback && fallbackResult.resolvedSrc
        ? fallbackResult.resolvedSrc
        : null;

  const isLoading =
    (!activeUrl && primary.isLoading) ||
    ((primary.hasError || imgFailedPrimary) && Boolean(fallbackSrc) && fallbackResult.isLoading);

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-secondary-background select-none',
        ASPECT_CLASSES[aspect],
        className,
      )}
    >
      {isLoading && (
        <div className="absolute inset-0 checkpoint-shimmer" aria-hidden="true" />
      )}

      {finalSrc ? (
        <img
          src={finalSrc}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => onResolvedSrc?.(finalSrc)}
          onError={() => {
            if (!imgFailedPrimary && finalSrc === primary.resolvedSrc) {
              setImgFailedPrimary(true);
            } else {
              setImgFailedFallback(true);
            }
            onResolvedSrc?.(null);
          }}
          className={cn(
            'h-full w-full object-cover object-center transition-opacity duration-300',
            imgClassName,
          )}
        />
      ) : !isLoading ? (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2.5 p-4 text-center"
          style={{
            background:
              'radial-gradient(circle at 30% 20%, rgba(var(--accent-active-rgb), 0.16), transparent 65%), linear-gradient(160deg, #1B2636 0%, #111722 100%)',
          }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface/80 border border-outline/75 text-muted">
            <Gamepad2 className="h-5 w-5" />
          </div>
          {showTitleOnFallback && (
            <span className="line-clamp-3 font-headline text-label-md text-on-surface/90 max-w-[90%]">
              {alt}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
