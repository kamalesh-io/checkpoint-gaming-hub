import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'ghost' | 'surface' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<IconButtonProps['variant']>, string> = {
  ghost: 'bg-transparent text-muted hover:text-on-background hover:bg-surface/80 border border-transparent',
  surface:
    'bg-surface/90 text-on-surface hover:bg-surface-elevated border border-outline/75 hover:border-accent-active/45',
  accent:
    'bg-accent-active text-on-accent-active hover:brightness-110 border border-transparent shadow-card',
  danger: 'bg-surface/90 text-muted hover:text-error hover:bg-error/15 border border-outline/75',
};

const SIZE_CLASSES: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-8 w-8 rounded-md',
  md: 'h-9 w-9 rounded-lg',
  lg: 'h-11 w-11 rounded-lg',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, label, variant = 'ghost', size = 'md', active = false, type = 'button', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        data-nav-item="true"
        aria-label={label}
        title={label}
        aria-pressed={active || undefined}
        className={cn(
          'inline-flex items-center justify-center shrink-0 transition-all duration-state-change ease-state-change',
          'disabled:opacity-45 disabled:pointer-events-none active:scale-95',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          active && 'border-accent-active/70 text-accent-active bg-surface-elevated',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
