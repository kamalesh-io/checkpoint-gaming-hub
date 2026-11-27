import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Gamepad2,
  Layers,
  ListOrdered,
  Plus,
  Trophy,
} from 'lucide-react';
import { CinematicHero } from '@/components/game/CinematicHero';
import { GameCoverCard } from '@/components/game/GameCoverCard';
import { GameShelf } from '@/components/game/GameShelf';
import { LandscapeGameCard } from '@/components/game/LandscapeGameCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { GameCoverSkeleton, HeroSkeleton, LandscapeCardSkeleton } from '@/components/ui/Skeleton';
import { ArtworkSelectorModal } from '@/features/modals/ArtworkSelectorModal';
import { UpdateProgressModal } from '@/features/modals/UpdateProgressModal';
import {
  useBacklogSummaryQuery,
  useLibraryQuery,
  usePlannerSessionsQuery,
  useSystemStatsQuery,
  useUpdateGameMutation,
} from '@/hooks/queries';
import { buildGameDetailsRoute, ROUTES } from '@/routes/routes';
import { CONTROLLER_CUSTOM_EVENT } from '@/hooks/useSpatialNavigation';
import type { ControllerActionEvent } from '@/services/gamepad/types';
import { useControllerStore } from '@/stores/controllerStore';
import { useToastStore } from '@/stores/toastStore';
import type { LibraryEntryRead, PlayingStatus } from '@/types';
import { formatHoursLogged, formatShortDate } from '@/utils/format';

const PRIORITY_WEIGHT: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

export function OverviewPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const libraryQuery = useLibraryQuery({ limit: 100, sort: 'recently_played' });
  const backlogQuery = useBacklogSummaryQuery();
  const plannerQuery = usePlannerSessionsQuery({ status: 'Scheduled' });
  const statsQuery = useSystemStatsQuery();
  const updateMutation = useUpdateGameMutation();

  const setBpActiveEntryId = useControllerStore((s) => s.setBigPictureActiveEntryId);
  const [activeHeroId, setActiveHeroId] = useState<string | null>(null);
  const [progressTarget, setProgressTarget] = useState<LibraryEntryRead | null>(null);
  const [artworkTarget, setArtworkTarget] = useState<LibraryEntryRead | null>(null);

  const entries = useMemo(
    () => (libraryQuery.data?.data ?? []).filter((e) => e.ownership_status !== 'To Buy'),
    [libraryQuery.data],
  );

  const currentlyPlaying = useMemo(
    () => entries.filter((e) => e.playing_status === 'Currently Playing'),
    [entries],
  );

  const heroEntry = useMemo(() => {
    if (entries.length === 0) return null;
    if (activeHeroId) {
      const explicit = entries.find((e) => e.id === activeHeroId);
      if (explicit) return explicit;
    }
    return (
      currentlyPlaying[0] ??
      entries.find((e) => e.playing_status === 'Planned') ??
      entries[0] ??
      null
    );
  }, [entries, activeHeroId, currentlyPlaying]);

  const handleSelectHero = (id: string) => {
    setActiveHeroId(id);
    setBpActiveEntryId(id);
  };

  const stepCarousel = (direction: -1 | 1) => {
    if (currentlyPlaying.length === 0) return;
    const currentIdx = currentlyPlaying.findIndex((item) => item.id === heroEntry?.id);
    const safeIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = (safeIdx + direction + currentlyPlaying.length) % currentlyPlaying.length;
    const next = currentlyPlaying[nextIdx];
    if (next) handleSelectHero(next.id);
  };

  const upNext = useMemo(() => {
    if (backlogQuery.data?.queue && backlogQuery.data.queue.length > 0) {
      return backlogQuery.data.queue.slice(0, 12);
    }
    return entries
      .filter((e) => e.playing_status === 'Planned' || e.playing_status === 'On Hold')
      .sort((a, b) => {
        const pw = (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
        if (pw !== 0) return pw;
        return a.queue_position - b.queue_position;
      })
      .slice(0, 12);
  }, [backlogQuery.data, entries]);

  const recentlyAdded = useMemo(
    () =>
      [...entries]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 12),
    [entries],
  );

  const recentlyCompleted = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            e.playing_status === 'Completed' || e.playing_status === '100% Completed',
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        .slice(0, 12),
    [entries],
  );

  const scheduledEntries = useMemo(
    () =>
      entries
        .filter((e) => e.planned_start_date || e.target_completion_date)
        .sort((a, b) => {
          const da = a.planned_start_date ?? a.target_completion_date ?? '9999';
          const db = b.planned_start_date ?? b.target_completion_date ?? '9999';
          return da.localeCompare(db);
        })
        .slice(0, 4),
    [entries],
  );

  const handleQuickStatusChange = async (
    entry: LibraryEntryRead,
    status: PlayingStatus,
  ) => {
    try {
      await updateMutation.mutateAsync({
        entryId: entry.id,
        updates: { playing_status: status },
      });
      addToast({
        type: 'success',
        title: 'Status updated',
        description: `${entry.game.title} marked ${status}.`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Failed to update status',
      });
    }
  };

  const handleToggleFavorite = async (entry: LibraryEntryRead) => {
    try {
      await updateMutation.mutateAsync({
        entryId: entry.id,
        updates: { is_favorite: !entry.is_favorite },
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Failed to update favorite state',
      });
    }
  };

  const handleCarouselKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (currentlyPlaying.length <= 1) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      stepCarousel(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stepCarousel(-1);
    }
  };

  // Support controller X (QUICK_ACTION) to open Update Progress for current spotlight game
  const currentSpotlightId = heroEntry?.id ?? null;
  useEffect(() => {
    const onController = (ev: Event) => {
      const detail = (ev as CustomEvent<ControllerActionEvent>).detail;
      if (!detail || document.querySelector('[aria-modal="true"]')) return;
      if (detail.action === 'QUICK_ACTION' && heroEntry && heroEntry.id === currentSpotlightId) {
        ev.preventDefault();
        setProgressTarget(heroEntry);
      }
    };
    window.addEventListener(CONTROLLER_CUSTOM_EVENT, onController);
    return () => window.removeEventListener(CONTROLLER_CUSTOM_EVENT, onController);
  }, [currentSpotlightId, heroEntry]);

  if (libraryQuery.isLoading) {
    return (
      <div className="space-y-8">
        <HeroSkeleton />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <LandscapeCardSkeleton key={i} className="w-[300px] shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <GameCoverSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (libraryQuery.isError) {
    return (
      <ErrorState
        title="Unable to load Overview Dashboard"
        message={
          libraryQuery.error instanceof Error
            ? libraryQuery.error.message
            : 'Unable to load library entries.'
        }
        onRetry={() => void libraryQuery.refetch()}
      />
    );
  }

  // Honest, Atmospheric First-Launch Onboarding State
  if (entries.length === 0) {
    return (
      <div className="space-y-8 py-4">
        <EmptyState
          icon={<Compass className="h-8 w-8" />}
          title="Welcome to CHECKPOINT Gaming Hub"
          description="Your local gaming hub is ready. Search IGDB for any title, separate ownership from playing status, cache high-res SteamGridDB covers & heroes locally, and curate your playthroughs."
          actions={
            <>
              <Button
                variant="accent"
                size="lg"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => navigate(ROUTES.DISCOVER)}
              >
                Discover & Import Your First Game
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate(ROUTES.SETTINGS)}
              >
                Check Local Integrations
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="space-y-9 pb-8">
      {/* Dynamic Featured Hero */}
      {heroEntry && (
        <CinematicHero
          entry={heroEntry}
          onViewDetails={(e) => navigate(buildGameDetailsRoute(e.id))}
          onUpdateProgress={(e) => setProgressTarget(e)}
          onChangeArtwork={(e) => setArtworkTarget(e)}
        />
      )}

      {/* Currently Playing 16:9 Carousel (Always rendered with Stitch design; empty state when 0) */}
      <div onKeyDown={handleCarouselKeyDown}>
        <GameShelf
          title="Currently Playing"
          subtitle="Select a title to preview its atmospheric theme and cinematic hero"
          count={currentlyPlaying.length}
          headerAction={
            <div className="flex items-center gap-2">
              {currentlyPlaying.length > 1 && (
                <div className="flex items-center gap-1">
                  <IconButton
                    label="Previous currently playing title"
                    variant="surface"
                    size="sm"
                    onClick={() => stepCarousel(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label="Next currently playing title"
                    variant="surface"
                    size="sm"
                    onClick={() => stepCarousel(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </IconButton>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(ROUTES.LIBRARY)}
              >
                View Library
              </Button>
            </div>
          }
        >
          {currentlyPlaying.length > 0 ? (
            currentlyPlaying.map((entry) => (
              <LandscapeGameCard
                key={entry.id}
                entry={entry}
                isActive={entry.id === heroEntry?.id}
                onSelect={(e) => handleSelectHero(e.id)}
                onOpenDetails={(e) => navigate(buildGameDetailsRoute(e.id))}
              />
            ))
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full p-6 rounded-xl border border-dashed border-outline/70 bg-secondary-background/60 text-muted">
              <div className="space-y-1">
                <p className="text-body-md font-medium text-on-surface">
                  No games currently marked as Playing
                </p>
                <p className="text-body-sm text-muted">
                  Select a title from Up Next or My Library and set its playing status to "Currently Playing" to feature it here.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="accent" size="sm" onClick={() => navigate(ROUTES.LIBRARY)}>
                  Browse Library
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate(ROUTES.DISCOVER)}>
                  Discover Games
                </Button>
              </div>
            </div>
          )}
        </GameShelf>
      </div>

      {/* Up Next Priority Shelf */}
      {upNext.length > 0 && (
        <GameShelf
          title="Up Next"
          subtitle="Planned & on-hold titles ordered by priority"
          count={upNext.length}
          headerAction={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(ROUTES.BACKLOG)}
            >
              Backlog Queue
            </Button>
          }
        >
          {upNext.map((entry) => (
            <div key={entry.id} className="w-[172px] sm:w-[190px] shrink-0">
              <GameCoverCard
                entry={entry}
                onOpenDetails={(e) => navigate(buildGameDetailsRoute(e.id))}
                onUpdateProgress={(e) => setProgressTarget(e)}
                onQuickStatusChange={(e, status) =>
                  void handleQuickStatusChange(e, status)
                }
                onToggleFavorite={(e) => void handleToggleFavorite(e)}
              />
            </div>
          ))}
        </GameShelf>
      )}

      {/* Two-Column Schedule + Compact Real Statistics */}
      <section className="grid gap-6 lg:grid-cols-5">
        {/* Upcoming Schedule Card (Honest Deferred State + Real Target Dates) */}
        <div className="lg:col-span-3 rounded-2xl border border-outline/75 bg-secondary-background/80 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="h-5 w-5 text-accent-active" />
              <h2 className="font-headline text-headline-md text-on-background">
                Upcoming Schedule
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                data-nav-item="true"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/planner')}
                className="text-label-sm text-accent-primary hover:underline"
              >
                Open Planner
              </Button>
              <Badge tone="accent" size="sm">
                Local SQLite
              </Badge>
            </div>
          </div>

          {(plannerQuery.data && plannerQuery.data.length > 0) ? (
            <div className="space-y-2.5">
              {plannerQuery.data.slice(0, 4).map((session) => (
                <button
                  key={session.id}
                  type="button"
                  data-nav-item="true"
                  onClick={() =>
                    session.library_entry
                      ? navigate(buildGameDetailsRoute(session.library_entry.id))
                      : navigate('/planner')
                  }
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-outline/70 bg-surface/55 px-4 py-3 text-left hover:border-accent-active/60 hover:bg-surface-elevated transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-headline text-headline-sm text-on-background truncate">
                      {session.library_entry?.game.title ?? 'Gaming Session'}
                    </p>
                    <p className="text-body-sm text-muted">
                      {new Date(session.scheduled_start).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      ({session.duration_minutes}m)
                    </p>
                  </div>
                  <Badge tone="accent" size="sm">
                    {session.status}
                  </Badge>
                </button>
              ))}
            </div>
          ) : scheduledEntries.length > 0 ? (
            <div className="space-y-2.5">
              {scheduledEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  data-nav-item="true"
                  onClick={() => navigate(buildGameDetailsRoute(entry.id))}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-outline/70 bg-surface/55 px-4 py-3 text-left hover:border-accent-active/60 hover:bg-surface-elevated transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-headline text-headline-sm text-on-background truncate">
                      {entry.game.title}
                    </p>
                    <p className="text-body-sm text-muted">
                      {entry.planned_start_date
                        ? `Planned Start: ${formatShortDate(entry.planned_start_date)}`
                        : `Target Completion: ${formatShortDate(entry.target_completion_date)}`}
                    </p>
                  </div>
                  <Badge tone="accent" size="sm">
                    {entry.priority}
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-body-sm text-muted">
              No sessions scheduled yet. Plan your target sessions in the Gaming Planner.
            </p>
          )}
        </div>

        {/* Compact Honest Statistics Summary */}
        <div className="lg:col-span-2 rounded-2xl border border-outline/75 bg-secondary-background/80 p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Trophy className="h-5 w-5 text-accent-gold" />
              <h2 className="font-headline text-headline-md text-on-background">
                Library Snapshot
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(ROUTES.STATISTICS)}
            >
              Details
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-outline/65 bg-surface/55 p-3.5">
              <div className="flex items-center gap-2 text-body-sm text-muted">
                <Layers className="h-4 w-4 text-primary" />
                <span>Total Games</span>
              </div>
              <p className="mt-1 font-headline text-headline-lg tabular-nums text-on-background">
                {stats?.total_library_games ?? entries.length}
              </p>
            </div>

            <div className="rounded-xl border border-outline/65 bg-surface/55 p-3.5">
              <div className="flex items-center gap-2 text-body-sm text-muted">
                <Gamepad2 className="h-4 w-4 text-accent-active" />
                <span>Playing Now</span>
              </div>
              <p className="mt-1 font-headline text-headline-lg tabular-nums text-on-background">
                {currentlyPlaying.length}
              </p>
            </div>

            <div className="rounded-xl border border-outline/65 bg-surface/55 p-3.5">
              <div className="flex items-center gap-2 text-body-sm text-muted">
                <ListOrdered className="h-4 w-4 text-accent-amber" />
                <span>Backlog Queue</span>
              </div>
              <p className="mt-1 font-headline text-headline-lg tabular-nums text-on-background">
                {stats?.backlog_count ?? upNext.length}
              </p>
            </div>

            <div className="rounded-xl border border-outline/65 bg-surface/55 p-3.5">
              <div className="flex items-center gap-2 text-body-sm text-muted">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Completed</span>
              </div>
              <p className="mt-1 font-headline text-headline-lg tabular-nums text-on-background">
                {stats?.completed_games ?? recentlyCompleted.length}
              </p>
            </div>
          </div>

          <p className="text-[12px] text-muted">
            Logged Playtime: {formatHoursLogged(stats?.total_hours_logged)}
          </p>
        </div>
      </section>

      {/* Recently Added */}
      {recentlyAdded.length > 0 && (
        <GameShelf title="Recently Added" count={recentlyAdded.length}>
          {recentlyAdded.map((entry) => (
            <div key={entry.id} className="w-[172px] sm:w-[190px] shrink-0">
              <GameCoverCard
                entry={entry}
                onOpenDetails={(e) => navigate(buildGameDetailsRoute(e.id))}
                onUpdateProgress={(e) => setProgressTarget(e)}
                onQuickStatusChange={(e, status) =>
                  void handleQuickStatusChange(e, status)
                }
                onToggleFavorite={(e) => void handleToggleFavorite(e)}
              />
            </div>
          ))}
        </GameShelf>
      )}

      {/* Recently Completed */}
      {recentlyCompleted.length > 0 && (
        <GameShelf title="Completed Shelf" count={recentlyCompleted.length}>
          {recentlyCompleted.map((entry) => (
            <div key={entry.id} className="w-[172px] sm:w-[190px] shrink-0">
              <GameCoverCard
                entry={entry}
                onOpenDetails={(e) => navigate(buildGameDetailsRoute(e.id))}
                onUpdateProgress={(e) => setProgressTarget(e)}
              />
            </div>
          ))}
        </GameShelf>
      )}

      {/* Modals */}
      <UpdateProgressModal
        entry={progressTarget}
        isOpen={Boolean(progressTarget)}
        onClose={() => setProgressTarget(null)}
      />

      <ArtworkSelectorModal
        entry={artworkTarget}
        isOpen={Boolean(artworkTarget)}
        initialTab="hero"
        onClose={() => setArtworkTarget(null)}
      />
    </div>
  );
}
