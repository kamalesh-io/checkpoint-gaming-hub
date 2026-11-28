import { Play } from 'lucide-react';
import type { LibraryEntryRead } from '@/types';
import { formatHoursLogged } from '@/utils/format';
import { GameArtwork } from './GameArtwork';
import { GameLogo } from './GameLogo';
import { cn } from '@/utils/cn';

export interface LandscapeGameCardProps {
  entry: LibraryEntryRead;
  isActive?: boolean;
  onSelect: (entry: LibraryEntryRead) => void;
  onHover?: (entry: LibraryEntryRead) => void;
  onOpenDetails?: (entry: LibraryEntryRead) => void;
  className?: string;
}

/**
 * 16:9 Console Game Card matching the "Continue Playing" shelf in V1.1.0 reference:
 * - Active glowing yellow/accent outer ring
 * - Landscape artwork
 * - Game logo / display title centered
 * - Pill badge at bottom: ▶ {progress}% · {hours} h
 */
export function LandscapeGameCard({
  entry,
  isActive = false,
  onSelect,
  onHover,
  onOpenDetails,
  className,
}: LandscapeGameCardProps) {
  const heroOrCoverUrl =
    entry.artwork?.hero_url ??
    entry.artwork?.cover_url ??
    entry.game.artworks.find((a) => a.asset_type === 'hero')?.remote_url ??
    null;

  const hoursLoggedText = formatHoursLogged(entry.hours_played);

  return (
    <div
      role="button"
      tabIndex={0}
      data-nav-item="true"
      aria-pressed={isActive}
      onClick={() => onSelect(entry)}
      onMouseEnter={() => onHover?.(entry)}
      onFocus={() => onHover?.(entry)}
      onDoubleClick={() => onOpenDetails?.(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(entry);
        }
      }}
      className={cn(
        'group relative w-[270px] sm:w-[300px] shrink-0 overflow-hidden rounded-2xl text-left cursor-pointer checkpoint-nav-card select-none',
        'transition-all duration-300 ease-out bg-surface',
        isActive
          ? 'border-2 border-accent-active shadow-[0_0_24px_rgba(var(--accent-active-rgb),0.55)] scale-[1.02]'
          : 'border border-outline/70 hover:border-outline hover:scale-[1.01] shadow-card',
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
          imgClassName="transition-transform duration-300 group-hover:scale-105"
        />

        {/* Dual dark scrims for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/20" />

        {/* Top-left Ownership Badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
          {entry.ownership_status === 'Family Shared' && (
            <span className="rounded-md bg-cyan-500/35 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-cyan-200 border border-cyan-400/50 shadow-sm">
              Fam
            </span>
          )}
          {entry.ownership_status === 'Owned' && (
            <span className="rounded-md bg-emerald-500/30 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-emerald-200 border border-emerald-400/40 shadow-sm">
              Owned
            </span>
          )}
        </div>

        {/* Centered Game Logo / Title */}
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
          <GameLogo
            logoUrl={entry.artwork?.logo_url}
            title={entry.game.title}
            size="md"
            className="max-h-12 max-w-[200px]"
            fallbackClassName="text-headline-md font-bold text-center text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
          />
        </div>

        {/* Bottom Telemetry Pill: ▶ 42% · 38.6 h */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white/90 border border-white/10">
            <Play className="h-2.5 w-2.5 fill-white text-white shrink-0" />
            <span className="tabular-nums">{Math.round(entry.progress_pct)}%</span>
            <span className="text-white/40">·</span>
            <span className="tabular-nums">{hoursLoggedText}</span>
          </div>

          {entry.is_favorite && (
            <span className="h-2 w-2 rounded-full bg-accent-active shadow-[0_0_6px_var(--accent-active)]" />
          )}
        </div>
      </div>
    </div>
  );
}
