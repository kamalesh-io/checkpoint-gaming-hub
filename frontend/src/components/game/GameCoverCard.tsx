import { useState, type MouseEvent } from 'react';
import {
  CheckCircle2,
  Eye,
  Heart,
  MoreHorizontal,
  Play,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { ContextMenu, type ContextMenuItem, type ContextMenuState } from '@/components/ui/ContextMenu';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PlayingStatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/utils/cn';
import type { LibraryEntryRead, PlayingStatus } from '@/types';
import { formatReleaseYear } from '@/utils/format';
import { GameArtwork } from './GameArtwork';

export interface GameCoverCardProps {
  entry: LibraryEntryRead;
  onOpenDetails: (entry: LibraryEntryRead) => void;
  onHover?: (entry: LibraryEntryRead) => void;
  onUpdateProgress?: (entry: LibraryEntryRead) => void;
  onQuickStatusChange?: (entry: LibraryEntryRead, status: PlayingStatus) => void;
  onToggleFavorite?: (entry: LibraryEntryRead) => void;
  onRemove?: (entry: LibraryEntryRead) => void;
  size?: 'compact' | 'default' | 'large';
  className?: string;
}

export function GameCoverCard({
  entry,
  onOpenDetails,
  onHover,
  onUpdateProgress,
  onQuickStatusChange,
  onToggleFavorite,
  onRemove,
  size = 'default',
  className,
}: GameCoverCardProps) {
  const [menuPos, setMenuPos] = useState<ContextMenuState | null>(null);

  const coverUrl =
    entry.artwork?.cover_url ??
    entry.game.artworks.find((a) => a.asset_type === 'cover' && a.is_active)?.cached_url ??
    entry.game.artworks.find((a) => a.asset_type === 'cover')?.remote_url ??
    null;

  const openContextAt = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const contextItems: ContextMenuItem[] = [
    {
      id: 'details',
      label: 'Open Game Details',
      icon: <Eye className="h-4 w-4" />,
      onSelect: () => onOpenDetails(entry),
    },
    ...(onUpdateProgress
      ? [
          {
            id: 'progress',
            label: 'Update Progress',
            icon: <SlidersHorizontal className="h-4 w-4" />,
            onSelect: () => onUpdateProgress(entry),
          },
        ]
      : []),
    ...(onQuickStatusChange
      ? [
          {
            id: 'playing',
            label: 'Mark Currently Playing',
            icon: <Play className="h-4 w-4" />,
            dividerBefore: true,
            onSelect: () => onQuickStatusChange(entry, 'Currently Playing'),
          },
          {
            id: 'completed',
            label: 'Mark Completed',
            icon: <CheckCircle2 className="h-4 w-4" />,
            onSelect: () => onQuickStatusChange(entry, 'Completed'),
          },
        ]
      : []),
    ...(onToggleFavorite
      ? [
          {
            id: 'favorite',
            label: entry.is_favorite ? 'Remove from Favorites' : 'Add to Favorites',
            icon: <Heart className="h-4 w-4" />,
            onSelect: () => onToggleFavorite(entry),
          },
        ]
      : []),
    ...(onRemove
      ? [
          {
            id: 'remove',
            label: 'Remove from Library',
            icon: <Trash2 className="h-4 w-4" />,
            danger: true,
            dividerBefore: true,
            onSelect: () => onRemove(entry),
          },
        ]
      : []),
  ];

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        data-nav-item="true"
        onClick={() => onOpenDetails(entry)}
        onMouseEnter={() => onHover?.(entry)}
        onFocus={() => onHover?.(entry)}
        onContextMenu={openContextAt}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenDetails(entry);
          }
        }}
        className={cn(
          'group relative flex flex-col text-left rounded-xl transition-all duration-card-hover ease-card-hover cursor-pointer checkpoint-nav-card',
          'hover:-translate-y-1 focus-visible:-translate-y-1',
          className,
        )}
      >
        {/* 2:3 Portrait Poster */}
        <div
          className={cn(
            'relative overflow-hidden rounded-xl border border-outline/60 bg-secondary-background shadow-card transition-all duration-card-hover',
            'group-hover:border-accent-active/70 group-hover:shadow-card-hover',
          )}
        >
          <GameArtwork
            src={coverUrl}
            alt={entry.game.title}
            aspect="portrait"
            className="w-full"
            imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
          />

          {/* Top Floating Pills */}
          <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-1 flex-wrap max-w-[calc(100%-36px)]">
              <span className="rounded-md bg-background/85 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-medium text-on-surface border border-outline/60 truncate">
                {entry.platform}
              </span>
              {entry.ownership_status === 'Family Shared' && (
                <span className="rounded-md bg-cyan-500/25 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-400/50 shadow-sm">
                  Fam
                </span>
              )}
              {entry.ownership_status === 'Owned' && (
                <span className="rounded-md bg-emerald-500/20 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-400/40 shadow-sm">
                  Owned
                </span>
              )}
            </div>

            <button
              type="button"
              data-nav-item="true"
              aria-label={`More actions for ${entry.game.title}`}
              onClick={openContextAt}
              className={cn(
                'pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md',
                'bg-background/80 backdrop-blur-md border border-outline/60 text-on-surface',
                'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:border-accent-active',
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Bottom Scrim Metadata Reveal */}
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 p-2.5 pt-10',
              'bg-gradient-to-t from-background/95 via-background/70 to-transparent',
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <PlayingStatusBadge status={entry.playing_status} size="sm" />
              {entry.is_favorite && (
                <Heart className="h-3.5 w-3.5 fill-accent-active text-accent-active shrink-0" />
              )}
            </div>
            {entry.progress_pct > 0 && <ProgressBar value={entry.progress_pct} height="xs" />}
          </div>
        </div>

        {/* Clean Title Caption Below Cover */}
        <div className={cn('mt-2.5 px-0.5', size === 'compact' && 'mt-2')}>
          <h3
            className={cn(
              'font-headline text-on-background group-hover:text-accent-active transition-colors truncate',
              size === 'compact' ? 'text-label-md' : 'text-headline-sm',
            )}
          >
            {entry.game.title}
          </h3>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-body-sm text-muted">
            <span className="truncate">
              {formatReleaseYear(entry.game.release_date)}
              {entry.game.genres[0]?.name ? ` · ${entry.game.genres[0].name}` : ''}
            </span>
            {entry.progress_pct > 0 && (
              <span className="tabular-nums text-[12px] text-on-surface/80 shrink-0">
                {Math.round(entry.progress_pct)}%
              </span>
            )}
          </div>
        </div>
      </div>

      <ContextMenu
        position={menuPos}
        onClose={() => setMenuPos(null)}
        headerTitle={entry.game.title}
        items={contextItems}
      />
    </>
  );
}
