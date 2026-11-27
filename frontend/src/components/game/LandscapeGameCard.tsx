import { ArrowUpRight } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { OwnershipStatusBadge, PlayingStatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/utils/cn';
import type { LibraryEntryRead } from '@/types';
import { GameArtwork } from './GameArtwork';

export interface LandscapeGameCardProps {
  entry: LibraryEntryRead;
  isActive?: boolean;
  onSelect: (entry: LibraryEntryRead) => void;
  onOpenDetails?: (entry: LibraryEntryRead) => void;
  className?: string;
}

export function LandscapeGameCard({
  entry,
  isActive = false,
  onSelect,
  onOpenDetails,
  className,
}: LandscapeGameCardProps) {
  const heroOrCoverUrl =
    entry.artwork?.hero_url ??
    entry.artwork?.cover_url ??
    entry.game.artworks.find((a) => a.asset_type === 'hero')?.remote_url ??
    null;

  return (
    <div
      role="button"
      tabIndex={0}
      data-nav-item="true"
      aria-pressed={isActive}
      onClick={() => onSelect(entry)}
      onDoubleClick={() => onOpenDetails?.(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(entry);
        }
      }}
      className={cn(
        'group relative w-[290px] sm:w-[320px] shrink-0 overflow-hidden rounded-xl border text-left cursor-pointer checkpoint-nav-card',
        'transition-all duration-card-hover ease-card-hover bg-secondary-background',
        isActive
          ? 'border-accent-active ring-2 ring-accent-active shadow-2xl checkpoint-accent-glow -translate-y-0.5'
          : 'border-outline/70 hover:border-outline hover:-translate-y-0.5 shadow-card',
        className,
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <GameArtwork
          src={heroOrCoverUrl}
          fallbackSrc={entry.artwork?.cover_url}
          alt={entry.game.title}
          aspect="landscape"
          className="h-full w-full"
          imgClassName="transition-transform duration-300 group-hover:scale-[1.04]"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />

        {/* Top badges */}
        <div className="absolute inset-x-3 top-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="rounded-md bg-background/80 backdrop-blur-md px-2 py-0.5 text-[11px] font-medium text-on-surface border border-outline/60">
              {entry.platform}
            </span>
            {isActive && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent-active/20 border border-accent-active/60 px-2 py-0.5 text-[11px] font-semibold text-accent-active backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-active animate-pulse" />
                Active
              </span>
            )}
          </div>
          {onOpenDetails && (
            <button
              type="button"
              data-nav-item="true"
              aria-label={`Open ${entry.game.title} details`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(entry);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 backdrop-blur-md border border-outline/60 text-muted hover:text-on-background hover:border-accent-active opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Bottom Overlay Content */}
        <div className="absolute inset-x-0 bottom-0 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <PlayingStatusBadge status={entry.playing_status} size="sm" />
            <OwnershipStatusBadge ownership={entry.ownership_status} size="sm" />
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <h3
              className={cn(
                'font-headline text-headline-sm truncate transition-colors',
                isActive ? 'text-accent-active' : 'text-on-background group-hover:text-accent-active',
              )}
            >
              {entry.game.title}
            </h3>
            <span className="tabular-nums text-[12px] font-medium text-muted shrink-0">
              {entry.progress_pct > 0 ? `${Math.round(entry.progress_pct)}%` : 'In Progress'}
            </span>
          </div>

          <ProgressBar value={entry.progress_pct} height="xs" />
        </div>
      </div>
    </div>
  );
}
