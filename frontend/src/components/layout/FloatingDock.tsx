import { type ElementType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Compass,
  FolderKanban,
  Heart,
  Home,
  Library,
  ListOrdered,
} from 'lucide-react';
import { soundManager } from '@/audio/soundManager';
import { SoundEvent } from '@/audio/soundEvents';
import { ROUTES } from '@/routes/routes';
import { cn } from '@/utils/cn';

interface DockItem {
  to: string;
  label: string;
  icon: ElementType;
  end?: boolean;
  badge?: number;
}

export interface FloatingDockProps {
  wishlistCount?: number;
  className?: string;
}

const DOCK_ITEMS: DockItem[] = [
  { to: ROUTES.OVERVIEW, label: 'Home', icon: Home, end: true },
  { to: ROUTES.LIBRARY, label: 'Library', icon: Library },
  { to: ROUTES.DISCOVER, label: 'Discover', icon: Compass },
  { to: ROUTES.BACKLOG, label: 'Backlog', icon: ListOrdered },
  { to: ROUTES.PLANNER, label: 'Planner', icon: CalendarDays },
  { to: ROUTES.WISHLIST, label: 'Wishlist', icon: Heart },
  { to: ROUTES.COLLECTIONS, label: 'Collections', icon: FolderKanban },
  { to: ROUTES.JOURNAL, label: 'Journal', icon: BookOpen },
  { to: ROUTES.STATISTICS, label: 'Statistics', icon: BarChart3 },
];

/**
 * Floating bottom navigation dock — CHECKPOINT V3 console-inspired design.
 * Translucent charcoal capsule with animated active indicator.
 */
export function FloatingDock({ wishlistCount, className }: FloatingDockProps) {
  const location = useLocation();

  return (
    <nav
      aria-label="Primary Navigation"
      className={cn(
        'fixed bottom-5 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-1 px-3 py-2',
        'rounded-full',
        'bg-dock/85 backdrop-blur-dock border border-dock-border/80',
        'shadow-dock',
        'select-none',
        className,
      )}
    >
      {DOCK_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.end
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to);
        const showBadge = item.to === ROUTES.WISHLIST && typeof wishlistCount === 'number' && wishlistCount > 0;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            data-nav-item="true"
            title={item.label}
            onClick={() => soundManager.play(SoundEvent.NAV_TAB)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5',
              'w-14 h-14 rounded-2xl transition-all duration-dock-hover',
              isActive
                ? 'bg-accent-active/15 text-on-background scale-105'
                : 'text-muted hover:text-on-background hover:bg-surface/50',
            )}
          >
            <div className="relative">
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  isActive ? 'text-accent-active' : '',
                )}
              />
              {showBadge && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-accent-active text-on-accent-active text-[10px] font-bold px-1 tabular-nums">
                  {wishlistCount! > 99 ? '99+' : wishlistCount}
                </span>
              )}
            </div>
            <span
              className={cn(
                'text-[10px] font-medium leading-tight transition-colors',
                isActive ? 'text-accent-active' : '',
              )}
            >
              {item.label}
            </span>
            {/* Active indicator dot */}
            {isActive && (
              <span className="absolute -bottom-0.5 h-[3px] w-5 rounded-full bg-accent-active" />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
