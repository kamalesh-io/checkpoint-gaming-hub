import { cn } from '@/utils/cn';

export interface ProgressBarProps {
  value: number;
  label?: string;
  showPercentage?: boolean;
  height?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function ProgressBar({
  value,
  label,
  showPercentage = false,
  height = 'sm',
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  const heightClasses =
    height === 'xs' ? 'h-1' : height === 'md' ? 'h-2.5' : 'h-1.5';

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="mb-1.5 flex items-center justify-between text-body-sm">
          {label ? <span className="text-muted">{label}</span> : <span />}
          {showPercentage && (
            <span className="tabular-nums font-medium text-on-surface">{Math.round(clamped)}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Completion progress'}
        className={cn('w-full overflow-hidden rounded-full bg-surface-elevated/90', heightClasses)}
      >
        <div
          className="h-full rounded-full bg-accent-active transition-all duration-300 ease-out shadow-[0_0_12px_rgba(var(--accent-active-rgb),0.55)]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
