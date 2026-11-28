import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Crosshair,
  List,
  MoreHorizontal,
  Play,
} from 'lucide-react';
import type { LibraryEntryRead } from '@/types';
import { formatHoursLogged } from '@/utils/format';
import { CinematicBackdrop } from './CinematicBackdrop';
import { GameLogo } from './GameLogo';
import { cn } from '@/utils/cn';

export interface CinematicHeroProps {
  entry: LibraryEntryRead;
  onViewDetails: (entry: LibraryEntryRead) => void;
  onUpdateProgress: (entry: LibraryEntryRead) => void;
  onChangeArtwork: (entry: LibraryEntryRead) => void;
  onPlayGame?: (entry: LibraryEntryRead) => void;
  carouselCount?: number;
  carouselIndex?: number;
  onPrevSlide?: () => void;
  onNextSlide?: () => void;
  onSelectSlide?: (index: number) => void;
}

/**
 * Full-bleed console-inspired Hero Showcase matching V1.1.0 reference image:
 * - "CURRENTLY PLAYING" accent pill
 * - Large transparent game logo
 * - Poetic summary tagline
 * - Dual telemetry: Progress % + Hours Played
 * - Glowing accent progress bar
 * - PlayStation-style White "Play Game" pill button
 * - Translucent "Game Details" and "•••" buttons
 * - Right-side carousel arrows & pagination dots
 */
export function CinematicHero({
  entry,
  onViewDetails,
  onUpdateProgress,
  onChangeArtwork,
  onPlayGame,
  carouselCount = 1,
  carouselIndex = 0,
  onPrevSlide,
  onNextSlide,
  onSelectSlide,
}: CinematicHeroProps) {
  const rawHeroUrl =
    entry.artwork?.hero_url ??
    entry.artwork?.cover_url ??
    entry.game.artworks.find((a) => a.asset_type === 'hero')?.remote_url ??
    entry.game.artworks.find((a) => a.asset_type === 'screenshot')?.remote_url ??
    null;

  const hoursLoggedText = formatHoursLogged(entry.hours_played);

  return (
    <section
      aria-label={`Featured Game: ${entry.game.title}`}
      className="relative min-h-[520px] lg:min-h-[580px] w-full overflow-hidden select-none"
    >
      {/* Background artwork with 800ms crossfade and dynamic atmosphere */}
      <CinematicBackdrop
        rawArtworkUrl={rawHeroUrl}
        gameId={entry.game_id}
        gameTitle={entry.game.title}
        backendAccentToken={entry.active_accent}
        syncAccent
      />

      {/* Foreground Content */}
      <div className="relative z-10 flex min-h-[520px] lg:min-h-[580px] flex-col justify-end px-6 sm:px-10 lg:px-14 pb-12 pt-20">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          {/* Left: Game Info & Primary Actions */}
          <div className="max-w-2xl space-y-4">
            {/* Header Status & Ownership Badges */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-accent-active" />
                <span className="font-headline text-xs font-bold tracking-widest uppercase text-accent-active">
                  {entry.playing_status === 'Currently Playing'
                    ? 'Currently Playing'
                    : entry.playing_status.toUpperCase()}
                </span>
              </div>

              {/* Ownership Tag: Owned vs Fam */}
              {entry.ownership_status === 'Family Shared' && (
                <span className="rounded-full bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider shadow-sm">
                  Fam
                </span>
              )}
              {entry.ownership_status === 'Owned' && (
                <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider shadow-sm">
                  Owned
                </span>
              )}
              {entry.ownership_status === 'Subscription' && (
                <span className="rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/40 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider shadow-sm">
                  Sub
                </span>
              )}
              {entry.ownership_status === 'Borrowed' && (
                <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider shadow-sm">
                  Borrowed
                </span>
              )}
            </div>

            {/* Transparent Game Logo or Fallback Title */}
            <div className="py-1">
              <GameLogo
                logoUrl={entry.artwork?.logo_url}
                title={entry.game.title}
                size="lg"
                className="max-h-24 sm:max-h-28"
              />
            </div>

            {/* Tagline / Synopsis */}
            {entry.game.summary && (
              <p className="line-clamp-2 text-body-md text-on-background/85 max-w-xl leading-relaxed drop-shadow-md">
                {entry.game.summary}
              </p>
            )}

            {/* Telemetry Row: Progress % + Hours Played (Click to update) */}
            <div
              role="button"
              tabIndex={0}
              data-nav-item="true"
              title="Click to update game progress"
              onClick={() => onUpdateProgress(entry)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onUpdateProgress(entry);
                }
              }}
              className="max-w-md space-y-2 pt-1 cursor-pointer group/progress"
            >
              <div className="flex items-center gap-6 text-body-sm font-medium text-on-background/90">
                <span className="inline-flex items-center gap-1.5 group-hover/progress:text-accent-active transition-colors">
                  <Crosshair className="h-4 w-4 text-accent-active" />
                  <span>Progress <strong className="text-on-background font-bold">{Math.round(entry.progress_pct)}%</strong></span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-accent-active" />
                  <span>Played <strong className="text-on-background font-bold">{hoursLoggedText}</strong></span>
                </span>
              </div>

              {/* Glowing Accent Progress Bar */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-elevated/70 border border-outline/50 group-hover/progress:border-accent-active/60 transition-colors">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_var(--accent-active)]"
                  style={{
                    width: `${Math.max(3, Math.min(100, entry.progress_pct))}%`,
                    backgroundColor: 'var(--accent-active)',
                  }}
                />
              </div>
            </div>

            {/* Actions matching PlayStation 5 & V1.1.0 Reference */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <button
                type="button"
                data-nav-item="true"
                onClick={() => (onPlayGame ? onPlayGame(entry) : onViewDetails(entry))}
                className="inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-6 py-2.5 text-label-md hover:bg-white/90 active:scale-95 shadow-[0_4px_20px_rgba(255,255,255,0.25)] transition-all"
              >
                <Play className="h-4 w-4 fill-black text-black" />
                <span>Play Game</span>
              </button>

              <button
                type="button"
                data-nav-item="true"
                onClick={() => onViewDetails(entry)}
                className="inline-flex items-center gap-2 rounded-full bg-surface-elevated/80 hover:bg-surface-elevated text-on-surface font-medium px-5 py-2.5 text-label-md border border-outline/70 active:scale-95 transition-all backdrop-blur-md"
              >
                <List className="h-4 w-4 text-muted" />
                <span>Game Details</span>
              </button>

              <button
                type="button"
                data-nav-item="true"
                title="Customize Art"
                onClick={() => onChangeArtwork(entry)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated/80 hover:bg-surface-elevated text-on-surface border border-outline/70 active:scale-95 transition-all backdrop-blur-md"
              >
                <MoreHorizontal className="h-4 w-4 text-muted" />
              </button>
            </div>
          </div>

          {/* Right: Carousel Controls & Pagination Dots */}
          {carouselCount > 1 && (
            <div className="flex flex-col items-end gap-3 shrink-0 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-nav-item="true"
                  aria-label="Previous Featured Game"
                  onClick={onPrevSlide}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated/80 hover:bg-surface-elevated border border-outline/70 text-on-surface hover:text-accent-active transition-colors backdrop-blur-md"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  data-nav-item="true"
                  aria-label="Next Featured Game"
                  onClick={onNextSlide}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated/80 hover:bg-surface-elevated border border-outline/70 text-on-surface hover:text-accent-active transition-colors backdrop-blur-md"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Dots */}
              <div className="flex items-center gap-1.5 pt-1">
                {Array.from({ length: carouselCount }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => onSelectSlide?.(i)}
                    className={cn(
                      'h-2 rounded-full transition-all duration-300',
                      i === carouselIndex
                        ? 'w-6 bg-accent-active shadow-[0_0_8px_var(--accent-active)]'
                        : 'w-2 bg-muted/40 hover:bg-muted/70',
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
