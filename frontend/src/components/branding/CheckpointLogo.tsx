import React from 'react';
import emblemUrl from '@/assets/Checkpoint Gaming Emblem.png';

interface CheckpointLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: {
    box: 'w-8 h-8',
    wordmark: 'text-headline-sm',
    subtitle: 'text-label-sm',
  },
  md: {
    box: 'w-11 h-11',
    wordmark: 'text-headline-md',
    subtitle: 'text-label-sm',
  },
  lg: {
    box: 'w-16 h-16',
    wordmark: 'text-display-md-mobile sm:text-display-md',
    subtitle: 'text-body-md',
  },
} as const;

export const CheckpointLogo: React.FC<CheckpointLogoProps> = ({
  size = 'lg',
  showWordmark = true,
  showSubtitle = false,
  className = '',
}) => {
  const scale = SIZE_MAP[size];

  return (
    <div className={`inline-flex items-center gap-lg select-none ${className}`}>
      <div
        className={`${scale.box} shrink-0 rounded-md overflow-hidden flex items-center justify-center`}
        aria-hidden="true"
      >
        <img
          src={emblemUrl}
          alt="Checkpoint"
          className="w-full h-full object-contain"
          decoding="async"
        />
      </div>

      {showWordmark && (
        <div className="flex flex-col">
          <span
            className={`font-headline ${scale.wordmark} tracking-tight text-on-background leading-none`}
          >
            CHECKPOINT
          </span>
          {showSubtitle && (
            <span className={`font-body ${scale.subtitle} text-muted mt-xs tracking-wide`}>
              Personal Gaming Hub
            </span>
          )}
        </div>
      )}
    </div>
  );
};
