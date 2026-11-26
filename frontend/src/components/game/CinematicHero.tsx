import { Calendar, Image as ImageIcon, Play, SlidersHorizontal, Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { OwnershipStatusBadge, PlayingStatusBadge, PriorityBadge } from '@/components/ui/StatusBadge';
import type { LibraryEntryRead } from '@/types';
import { formatIgdbRating, formatReleaseYear } from '@/utils/format';
import { CinematicBackdrop } from './CinematicBackdrop';
import { GameLogo } from './GameLogo';

export interface CinematicHeroProps {
  entry: LibraryEntryRead;
  onViewDetails: (entry: LibraryEntryRead) => void;
  onUpdateProgress: (entry: LibraryEntryRead) => void;
  onChangeArtwork: (entry: LibraryEntryRead) => void;
}

/**
 * Full-bleed atmospheric hero showcase aligned with CHECKPOINT V2 Stitch overview_dashboard.
 * Reuses the shared CinematicBackdrop crossfade & theme engine.
 */
export function CinematicHero({
  entry,
  onViewDetails,
  onUpdateProgress,
  onChangeArtwork,
}: CinematicHeroProps) {
  const rawHeroUrl =
    entry.artwork?.hero_url ??
    entry.artwork?.cover_url ??
    entry.game.artworks.find((a) => a.asset_type === 'hero')?.remote_url ??
    entry.game.artworks.find((a) => a.asset_type === 'screenshot')?.remote_url ??
    null;

  const igdbRatingText = formatIgdbRating(entry.game.igdb_rating);
  const releaseYear = formatReleaseYear(entry.game.release_date);

  return (
    <section
      aria-label={`Featured Game: ${entry.game.title}`}
      className="relative min-h-[430px] lg:min-h-[500px] w-full overflow-hidden rounded-2xl border border-outline/60 bg-secondary-background shadow-modal"
    >
      <CinematicBackdrop
        rawArtworkUrl={rawHeroUrl}
        gameId={entry.game_id}
        gameTitle={entry.game.title}
        backendAccentToken={entry.active_accent}
        syncAccent
      />

      {/* Foreground Cinematic Content */}
      <div className="relative z-10 flex min-h-[430px] lg:min-h-[500px] flex-col justify-end p-6 sm:p-9 lg:p-11">
        <div className="max-w-2xl space-y-4">
          {/* Status Row */}
          <div className="flex flex-wrap items-center gap-2">
            <PlayingStatusBadge status={entry.playing_status} />
            <OwnershipStatusBadge ownership={entry.ownership_status} />
            {entry.priority === 'High' && <PriorityBadge priority={entry.priority} size="md" />}
          </div>

          {/* Transparent Logo or Display Headline */}
          <div className="pt-1">
            <GameLogo logoUrl={entry.artwork?.logo_url} title={entry.game.title} size="lg" />
          </div>

          {/* Honest Metadata Strip */}
          <div className="flex flex-wrap items-center gap-2.5 text-body-sm text-muted">
            <Badge tone="neutral" size="sm">
              {entry.platform}
            </Badge>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {releaseYear}
            </span>
            {entry.game.developer && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-on-surface/90">{entry.game.developer}</span>
              </>
            )}
            {igdbRatingText && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-accent-gold font-semibold tabular-nums">
                  <Star className="h-3.5 w-3.5 fill-accent-gold text-accent-gold" />
                  {igdbRatingText} IGDB
                </span>
              </>
            )}
            {entry.game.genres.slice(0, 2).map((genre) => (
              <Badge key={genre.id} tone="outline" size="sm">
                {genre.name}
              </Badge>
            ))}
          </div>

          {/* Synopsis */}
          {entry.game.summary && (
            <p className="line-clamp-2 text-body-md text-on-surface/85 max-w-xl leading-relaxed">
              {entry.game.summary}
            </p>
          )}

          {/* Completion Telemetry */}
          <div className="max-w-md pt-1">
            <ProgressBar
              value={entry.progress_pct}
              label={`Goal: ${entry.completion_goal}`}
              showPercentage
              height="sm"
            />
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="accent"
              size="lg"
              leftIcon={<Play className="h-4 w-4 fill-current" />}
              onClick={() => onViewDetails(entry)}
            >
              View Game Details
            </Button>
            <Button
              variant="secondary"
              size="lg"
              leftIcon={<SlidersHorizontal className="h-4 w-4" />}
              onClick={() => onUpdateProgress(entry)}
            >
              Update Progress
            </Button>
            <Button
              variant="ghost"
              size="lg"
              leftIcon={<ImageIcon className="h-4 w-4" />}
              onClick={() => onChangeArtwork(entry)}
            >
              Customize Art
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
