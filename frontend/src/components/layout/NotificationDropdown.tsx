import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Database,
  Info,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ROUTES } from '@/routes/routes';
import { soundManager } from '@/audio/soundManager';
import { cn } from '@/utils/cn';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'deal' | 'system';
  read: boolean;
  link?: string;
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Steam Library Synchronized',
    message: '94 Steam titles indexed with playtime and capsule artwork.',
    timestamp: 'Just now',
    type: 'success',
    read: false,
    link: ROUTES.LIBRARY,
  },
  {
    id: 'notif-2',
    title: 'Local Database Active',
    message: 'SQLite database operating with WAL mode and local storage in %APPDATA%.',
    timestamp: '10m ago',
    type: 'system',
    read: false,
    link: ROUTES.SETTINGS,
  },
  {
    id: 'notif-3',
    title: 'Indian Regional Price Tracker Active',
    message: 'Valve official store API connected for verified INR (₹) price tracking.',
    timestamp: '1h ago',
    type: 'deal',
    read: false,
    link: ROUTES.WISHLIST,
  },
];

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function NotificationDropdown({ isOpen, onClose, triggerRef }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem('checkpoint_notifications');
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    try {
      localStorage.setItem('checkpoint_notifications', JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundManager.playBack();
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  const handleMarkAllRead = () => {
    soundManager.playClick();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAll = () => {
    soundManager.playBack();
    setNotifications([]);
  };

  const handleItemClick = (item: NotificationItem) => {
    soundManager.playSelect();
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
    );
    if (item.link) {
      navigate(item.link);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'absolute right-4 top-14 z-50 w-80 sm:w-96 rounded-2xl border border-outline/70',
        'bg-[#14181D]/95 backdrop-blur-xl shadow-2xl p-4 space-y-3 select-none text-left',
        'animate-in fade-in zoom-in-95 duration-150',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-outline/60 pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-accent-primary" />
          <span className="font-bold text-body-md text-on-background">Notifications</span>
          {unreadCount > 0 && (
            <Badge tone="accent" size="sm">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              data-nav-item="true"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-on-background px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Read all</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              data-nav-item="true"
              onClick={handleClearAll}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-error px-2 py-1 rounded-lg hover:bg-surface-elevated transition-colors"
              title="Clear all notifications"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            data-nav-item="true"
            onClick={onClose}
            className="p-1 text-muted hover:text-on-background rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-muted text-body-sm">
            <Sparkles className="mx-auto h-8 w-8 text-muted/40 mb-2" />
            <p>All caught up!</p>
            <p className="text-xs text-muted/60 mt-0.5">No active notifications</p>
          </div>
        ) : (
          notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              data-nav-item="true"
              onClick={() => handleItemClick(item)}
              className={cn(
                'w-full text-left rounded-xl p-3 border transition-all cursor-pointer flex items-start gap-3',
                item.read
                  ? 'border-outline/40 bg-surface/40 hover:bg-surface-elevated/60 text-muted'
                  : 'border-accent-primary/40 bg-surface-elevated hover:border-accent-primary text-on-background shadow-sm',
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                  item.type === 'success'
                    ? 'bg-success/15 text-success'
                    : item.type === 'deal'
                    ? 'bg-warning/15 text-warning'
                    : 'bg-accent-primary/15 text-accent-primary',
                )}
              >
                {item.type === 'success' && <Sparkles className="h-4 w-4" />}
                {item.type === 'deal' && <Tag className="h-4 w-4" />}
                {item.type === 'system' && <Database className="h-4 w-4" />}
                {item.type === 'info' && <Info className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'text-body-sm font-semibold truncate',
                      item.read ? 'text-on-background/80' : 'text-on-background',
                    )}
                  >
                    {item.title}
                  </span>
                  <span className="text-[10px] text-muted/70 shrink-0">{item.timestamp}</span>
                </div>
                <p className="text-[12px] text-muted mt-0.5 line-clamp-2 leading-relaxed">
                  {item.message}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
