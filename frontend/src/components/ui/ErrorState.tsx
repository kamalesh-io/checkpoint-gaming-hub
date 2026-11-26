import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

export interface ErrorStateProps {
  title: string;
  message: string;
  variant?: 'error' | 'offline' | 'warning';
  onRetry?: () => void;
  retryLabel?: string;
  actions?: ReactNode;
  className?: string;
}

export function ErrorState({
  title,
  message,
  variant = 'error',
  onRetry,
  retryLabel = 'Retry',
  actions,
  className,
}: ErrorStateProps) {
  const Icon = variant === 'offline' ? WifiOff : AlertTriangle;
  const toneClasses =
    variant === 'warning'
      ? 'border-warning/35 bg-warning/10 text-warning'
      : 'border-error/35 bg-error/10 text-error';

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-2xl border border-outline bg-secondary-background/85 px-8 py-10 shadow-card',
        className,
      )}
    >
      <div
        className={cn(
          'mb-4 flex h-12 w-12 items-center justify-center rounded-xl border',
          toneClasses,
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-headline text-headline-md text-on-background">{title}</h3>
      <p className="mt-2 text-body-md text-muted max-w-lg">{message}</p>
      {(onRetry || actions) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
