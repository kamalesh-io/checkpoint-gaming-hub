import type { ReactNode } from 'react';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  message?: string;
  actions?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  message,
  actions,
  actionLabel,
  onAction,
  className,
  compact = false,
}: EmptyStateProps) {
  const renderedDesc = description ?? message ?? '';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-2xl border border-outline/75 bg-secondary-background/60',
        compact ? 'px-6 py-8' : 'px-8 py-14',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated/90 border border-outline text-accent-active shadow-card">
        {icon ?? <Gamepad2 className="h-7 w-7" />}
      </div>
      <h3 className="font-headline text-headline-md text-on-background max-w-md">{title}</h3>
      {renderedDesc && (
        <p className="mt-2 text-body-md text-muted max-w-lg leading-relaxed">{renderedDesc}</p>
      )}
      {(actions || (actionLabel && onAction)) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actions}
          {actionLabel && onAction && (
            <Button data-nav-item="true" variant="primary" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
