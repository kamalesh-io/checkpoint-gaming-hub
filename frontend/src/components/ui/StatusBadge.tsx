import {
  Bookmark,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  HelpCircle,
  PauseCircle,
  Play,
  ShoppingBag,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { OwnershipStatus, PlayingStatus, PriorityLevel } from '@/types';

export interface PlayingStatusBadgeProps {
  status: PlayingStatus | string;
  size?: 'sm' | 'md';
  className?: string;
}

export function PlayingStatusBadge({ status, size = 'md', className }: PlayingStatusBadgeProps) {
  const normalized = status;

  const config: Record<string, { classes: string; icon: typeof Play }> = {
    'Currently Playing': {
      classes: 'bg-accent-active/20 text-accent-active border-accent-active/45',
      icon: Play,
    },
    Planned: {
      classes: 'bg-primary/15 text-primary border-primary/35',
      icon: Clock,
    },
    'On Hold': {
      classes: 'bg-warning/15 text-warning border-warning/35',
      icon: PauseCircle,
    },
    Completed: {
      classes: 'bg-success/15 text-success border-success/35',
      icon: CheckCircle2,
    },
    '100% Completed': {
      classes: 'bg-accent-gold/20 text-accent-gold border-accent-gold/45',
      icon: Crown,
    },
    Dropped: {
      classes: 'bg-error/15 text-error border-error/35',
      icon: XCircle,
    },
  };

  const entry = config[normalized] ?? {
    classes: 'bg-surface-elevated text-muted border-outline',
    icon: Clock,
  };
  const Icon = entry.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-label-sm',
        entry.classes,
        className,
      )}
    >
      <Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5', 'shrink-0')} />
      <span>{status}</span>
    </span>
  );
}

export interface OwnershipStatusBadgeProps {
  ownership: OwnershipStatus | string;
  size?: 'sm' | 'md';
  className?: string;
}

export function OwnershipStatusBadge({
  ownership,
  size = 'md',
  className,
}: OwnershipStatusBadgeProps) {
  const config: Record<string, { classes: string; icon: typeof Bookmark }> = {
    Owned: {
      classes: 'bg-surface-elevated/90 text-on-surface border-outline/80',
      icon: CheckCircle2,
    },
    'Family Shared': {
      classes: 'bg-accent-blue/15 text-accent-blue border-accent-blue/35',
      icon: Users,
    },
    'To Buy': {
      classes: 'bg-accent-amber/15 text-accent-amber border-accent-amber/40',
      icon: ShoppingBag,
    },
    Subscription: {
      classes: 'bg-success/15 text-success border-success/35',
      icon: Sparkles,
    },
    Unknown: {
      classes: 'bg-surface/80 text-muted border-outline/70',
      icon: HelpCircle,
    },
  };

  const entry = config[ownership] ?? {
    classes: 'bg-surface/80 text-muted border-outline/70',
    icon: HelpCircle,
  };
  const Icon = entry.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-label-sm',
        entry.classes,
        className,
      )}
    >
      <Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5', 'shrink-0')} />
      <span>{ownership}</span>
    </span>
  );
}

export interface PriorityBadgeProps {
  priority: PriorityLevel | string;
  size?: 'sm' | 'md';
  className?: string;
}

export function PriorityBadge({ priority, size = 'sm', className }: PriorityBadgeProps) {
  const classes =
    priority === 'High'
      ? 'bg-accent-amber/20 text-accent-amber border-accent-amber/40'
      : priority === 'Medium'
        ? 'bg-primary/15 text-primary border-primary/35'
        : 'bg-surface/80 text-muted border-outline/70';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-label-sm',
        classes,
        className,
      )}
    >
      <Flame className="h-3 w-3 shrink-0" />
      <span>{priority} Priority</span>
    </span>
  );
}
