import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  leftIcon?: ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-elevated/85 text-on-surface border border-outline/65',
  accent:
    'bg-accent-active/15 text-accent-active border border-accent-active/40',
  success: 'bg-success/15 text-success border border-success/35',
  warning: 'bg-warning/15 text-warning border border-warning/35',
  error: 'bg-error/15 text-error border border-error/35',
  outline: 'bg-transparent text-muted border border-outline',
};

export function Badge({
  className,
  tone = 'neutral',
  size = 'md',
  leftIcon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap select-none',
        size === 'sm' ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-label-sm',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {leftIcon}
      <span>{children}</span>
    </span>
  );
}
