import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftAdornment?: ReactNode;
  rightAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, leftAdornment, rightAdornment, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-label-sm text-muted font-medium">
            {label}
          </label>
        )}
        <div
          className={cn(
            'relative flex items-center rounded-lg bg-surface/90 border transition-colors duration-state-change',
            error
              ? 'border-error/80 focus-within:border-error'
              : 'border-outline focus-within:border-accent-active',
          )}
        >
          {leftAdornment && (
            <div className="pl-3 text-muted flex items-center shrink-0 pointer-events-none">
              {leftAdornment}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            data-nav-item="true"
            aria-invalid={Boolean(error) || undefined}
            className={cn(
              'w-full bg-transparent px-3 py-2 text-body-md text-on-surface placeholder:text-muted/60',
              'focus:outline-none disabled:opacity-50',
              Boolean(leftAdornment) && 'pl-2',
              Boolean(rightAdornment) && 'pr-2',
              className,
            )}
            {...props}
          />
          {rightAdornment && (
            <div className="pr-2.5 flex items-center shrink-0">{rightAdornment}</div>
          )}
        </div>
        {error ? (
          <p className="text-body-sm text-error">{error}</p>
        ) : helperText ? (
          <p className="text-body-sm text-muted/80">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
