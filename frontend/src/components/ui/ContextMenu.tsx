import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  dividerBefore?: boolean;
  onSelect: () => void;
}

export interface ContextMenuState {
  x: number;
  y: number;
}

export interface ContextMenuProps {
  position: ContextMenuState | null;
  onClose: () => void;
  items: ContextMenuItem[];
  headerTitle?: string;
}

export function ContextMenu({ position, onClose, items, headerTitle }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;

    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const handleScroll = () => onClose();

    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [position, onClose]);

  if (!position) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const clampedX = Math.min(position.x, vw - 240);
  const clampedY = Math.min(position.y, vh - Math.max(180, items.length * 40 + 48));

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{ top: Math.max(12, clampedY), left: Math.max(12, clampedX) }}
      className={cn(
        'fixed z-[70] min-w-[220px] max-w-[260px] rounded-xl py-1.5',
        'bg-secondary-background/95 backdrop-blur-xl border border-outline shadow-modal',
      )}
    >
      {headerTitle && (
        <div className="px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-outline/60 mb-1 truncate">
          {headerTitle}
        </div>
      )}
      {items.map((item) => (
        <div key={item.id}>
          {item.dividerBefore && <div className="my-1 border-t border-outline/60" />}
          <button
            type="button"
            role="menuitem"
            data-nav-item="true"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              item.onSelect();
            }}
            className={cn(
              'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-body-sm transition-colors',
              item.danger
                ? 'text-error hover:bg-error/15'
                : 'text-on-surface hover:bg-surface-elevated',
            )}
          >
            {item.icon && <span className="shrink-0 opacity-85">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
