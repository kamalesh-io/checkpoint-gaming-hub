import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  variant?: 'underline' | 'pill';
  className?: string;
  ariaLabel?: string;
}

export function Tabs<T extends string = string>({
  items,
  activeId,
  onChange,
  variant = 'underline',
  className,
  ariaLabel = 'Sections',
}: TabsProps<T>) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabledIndices = items
      .map((item, idx) => (!item.disabled ? idx : -1))
      .filter((idx) => idx !== -1);
    if (enabledIndices.length === 0) return;

    const currentPos = enabledIndices.indexOf(index);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIdx = enabledIndices[(currentPos + 1) % enabledIndices.length];
      if (nextIdx !== undefined && items[nextIdx]) {
        onChange(items[nextIdx].id);
        buttonRefs.current[nextIdx]?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIdx =
        enabledIndices[(currentPos - 1 + enabledIndices.length) % enabledIndices.length];
      if (prevIdx !== undefined && items[prevIdx]) {
        onChange(items[prevIdx].id);
        buttonRefs.current[prevIdx]?.focus();
      }
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        variant === 'underline'
          ? 'flex items-center gap-1 border-b border-outline/80 overflow-x-auto no-scrollbar'
          : 'inline-flex items-center gap-1 rounded-xl bg-secondary-background/90 p-1 border border-outline/75 overflow-x-auto no-scrollbar',
        className,
      )}
    >
      {items.map((item, index) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            data-nav-item="true"
            aria-selected={isActive}
            disabled={item.disabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'relative inline-flex items-center gap-2 whitespace-nowrap transition-all duration-state-change select-none',
              'disabled:opacity-45 disabled:pointer-events-none',
              variant === 'underline'
                ? cn(
                    'px-3 py-2.5 text-label-sm sm:text-label-md border-b-2 -mb-px',
                    isActive
                      ? 'border-accent-active text-on-background font-semibold'
                      : 'border-transparent text-muted hover:text-on-surface',
                  )
                : cn(
                    'px-3.5 py-1.5 rounded-lg text-label-sm',
                    isActive
                      ? 'bg-accent-active text-on-accent-active font-semibold shadow-sm'
                      : 'text-muted hover:text-on-surface hover:bg-surface/60',
                  ),
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[11px] tabular-nums',
                  isActive && variant === 'pill'
                    ? 'bg-on-accent-active/20 text-on-accent-active'
                    : 'bg-surface-elevated text-muted',
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
