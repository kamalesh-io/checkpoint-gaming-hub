import { type ElementType } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Compass,
  FolderKanban,
  Gamepad2,
  Home,
  Library,
  ListOrdered,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
} from 'lucide-react';
import { CheckpointLogo } from '@/components/branding/CheckpointLogo';
import { ROUTES } from '@/routes/routes';
import { useAppStore } from '@/stores/appStore';
import { useControllerStore } from '@/stores/controllerStore';
import { cn } from '@/utils/cn';

interface NavEntry {
  to: string;
  label: string;
  icon: ElementType;
  badge?: number;
  end?: boolean;
}

export interface SidebarProps {
  libraryCount?: number;
  wishlistCount?: number;
}

export function Sidebar({ libraryCount, wishlistCount }: SidebarProps) {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const connectedControllers = useControllerStore((s) => s.connectedControllers);
  const activeControllerName = useControllerStore((s) => s.activeControllerName);
  const gamepadConnected = connectedControllers.length > 0;

  const primaryItems: NavEntry[] = [
    { to: ROUTES.OVERVIEW, label: 'Overview', icon: Home, end: true },
    { to: ROUTES.LIBRARY, label: 'My Library', icon: Library, badge: libraryCount },
    { to: ROUTES.DISCOVER, label: 'Discover', icon: Compass },
  ];

  const organizeItems: NavEntry[] = [
    { to: ROUTES.BACKLOG, label: 'Backlog', icon: ListOrdered },
    { to: ROUTES.PLANNER, label: 'Gaming Planner', icon: CalendarDays },
    { to: ROUTES.WISHLIST, label: 'Wishlist', icon: ShoppingBag, badge: wishlistCount },
    { to: ROUTES.COLLECTIONS, label: 'Collections', icon: FolderKanban },
  ];

  const reflectItems: NavEntry[] = [
    { to: ROUTES.JOURNAL, label: 'Gaming Journal', icon: BookOpen },
    { to: ROUTES.STATISTICS, label: 'Statistics', icon: BarChart3 },
  ];

  const renderSection = (title: string, items: NavEntry[]) => (
    <div className="space-y-1">
      {!collapsed && (
        <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted/65">
          {title}
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            data-nav-item="true"
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-label-md transition-all duration-state-change',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-accent-active/15 text-on-background border border-accent-active/40 shadow-[inset_3px_0_0_var(--accent-active)]'
                  : 'text-muted hover:text-on-background hover:bg-surface/65 border border-transparent',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors',
                    isActive ? 'text-accent-active' : 'text-muted group-hover:text-on-background',
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <aside
      aria-label="Primary Navigation"
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-outline/75 bg-sidebar transition-all duration-200 select-none',
        collapsed ? 'w-[74px]' : 'w-[244px]',
      )}
    >
      {/* Top Brand Header */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-outline/70 px-3.5 shrink-0',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!collapsed && <CheckpointLogo size="sm" showWordmark showSubtitle={false} />}
        <button
          type="button"
          data-nav-item="true"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-on-background hover:bg-surface/80 transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Scrollable Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3">
        {renderSection('Library Hub', primaryItems)}
        {renderSection('Organize', organizeItems)}
        {renderSection('Track & Reflect', reflectItems)}
      </nav>

      {/* Bottom Mode & System Section */}
      <div className="border-t border-outline/70 p-2.5 space-y-1.5 shrink-0">
        <NavLink
          to={ROUTES.BIG_PICTURE}
          data-nav-item="true"
          title={collapsed ? 'Big Picture Mode' : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-label-md transition-colors border',
              collapsed && 'justify-center px-2',
              isActive
                ? 'bg-accent-active/15 text-on-background border-accent-active/45'
                : 'border-outline/60 bg-surface/50 text-on-surface hover:bg-surface-elevated',
            )
          }
        >
          <MonitorPlay className="h-[18px] w-[18px] shrink-0 text-accent-active" />
          {!collapsed && <span className="truncate">Big Picture</span>}
        </NavLink>

        <NavLink
          to={ROUTES.SETTINGS}
          data-nav-item="true"
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-label-md transition-colors border',
              collapsed && 'justify-center px-2',
              isActive
                ? 'bg-accent-active/15 text-on-background border-accent-active/40'
                : 'border-transparent text-muted hover:text-on-background hover:bg-surface/65',
            )
          }
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="truncate">Settings</span>}
        </NavLink>

        {!collapsed && (
          <div className="flex items-center gap-2 rounded-lg bg-background/60 border border-outline/60 px-2.5 py-1.5 text-[11px] text-muted">
            <Gamepad2
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                gamepadConnected ? 'text-success' : 'text-muted/60',
              )}
            />
            <span className="truncate">
              {gamepadConnected ? activeControllerName || 'Controller Connected' : 'No Controller Connected'}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
