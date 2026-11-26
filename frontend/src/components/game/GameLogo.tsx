import { useState } from 'react';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { cn } from '@/utils/cn';

export interface GameLogoProps {
  logoUrl: string | null | undefined;
  title: string;
  className?: string;
  fallbackClassName?: string;
  size?: 'md' | 'lg';
}

export function GameLogo({
  logoUrl,
  title,
  className,
  fallbackClassName,
  size = 'lg',
}: GameLogoProps) {
  const [failed, setFailed] = useState(false);
  const { resolvedSrc } = useAuthenticatedImage(logoUrl);

  if (resolvedSrc && !failed) {
    return (
      <img
        src={resolvedSrc}
        alt={title}
        decoding="async"
        onError={() => setFailed(true)}
        className={cn(
          'w-auto object-contain object-left drop-shadow-[0_6px_18px_rgba(0,0,0,0.75)] select-none',
          size === 'lg' ? 'max-h-24 sm:max-h-28 max-w-[360px] sm:max-w-[440px]' : 'max-h-16 max-w-[260px]',
          className,
        )}
      />
    );
  }

  return (
    <h1
      className={cn(
        'font-display text-display-lg-mobile sm:text-display-md lg:text-display-lg text-on-background drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] leading-[1.06]',
        size === 'md' && 'text-headline-lg sm:text-display-md-mobile',
        fallbackClassName,
      )}
    >
      {title}
    </h1>
  );
}
