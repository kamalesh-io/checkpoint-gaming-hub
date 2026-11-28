import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { soundManager } from '@/audio/soundManager';
import { SoundEvent } from '@/audio/soundEvents';
import { cn } from '@/utils/cn';

export type ButtonVariant = 'accent' | 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  accent:
    'bg-accent-active text-on-accent-active hover:brightness-110 shadow-[0_8px_24px_-4px_rgba(var(--accent-active-rgb),0.45)] border border-transparent font-semibold',
  primary:
    'bg-primary text-on-primary hover:brightness-110 shadow-card border border-transparent font-semibold',
  secondary:
    'bg-surface-elevated/90 text-on-surface hover:bg-surface-elevated border border-outline/80 hover:border-accent-active/50 font-medium',
  ghost:
    'bg-transparent text-muted hover:text-on-background hover:bg-surface/70 border border-transparent font-medium',
  danger:
    'bg-error/15 text-error hover:bg-error hover:text-on-error border border-error/40 font-semibold',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-label-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-label-md gap-2 rounded-lg',
  lg: 'h-11 px-5 text-label-lg gap-2.5 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const isDisabled = Boolean(disabled || isLoading);

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      soundManager.play(SoundEvent.BUTTON_CLICK);
      props.onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        data-nav-item="true"
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        onClick={handleClick}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap select-none transition-all duration-state-change ease-state-change',
          'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : leftIcon}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
