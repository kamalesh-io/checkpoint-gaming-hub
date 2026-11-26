import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Flame,
  Gamepad2,
  Kanban,
  ListOrdered,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useBacklogSummaryQuery,
  useMoveBacklogItemMutation,
  useSetAsNextMutation,
  useUpdateGameMutation,
} from '@/hooks/queries';
import { buildGameDetailsRoute } from '@/routes/routes';
import { useToastStore } from '@/stores/toastStore';
import type { LibraryEntryRead, PlayingStatus } from '@/types';
import { formatHoursLogged, formatShortDate } from '@/utils/format';

type ViewMode = 'queue' | 'board';

export function BacklogPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const [viewMode, setViewMode] = useState<ViewMode>('queue');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [franchiseFilter, setFranchiseFilter] = useState<string>('all');

  const { data: backlogData, isLoading, isError, refetch } = useBacklogSummaryQuery();
  const moveMutation = useMoveBacklogItemMutation();
  const setAsNextMutation = useSetAsNextMutation();
  const updateGameMutation = useUpdateGameMutation();

  const rawQueue = useMemo(() => backlogData?.queue ?? [], [backlogData]);

  // Extract unique franchises from the queue for filtering
  const availableFranchises = useMemo(() => {
    const set = new Set<string>();
    rawQueue.forEach((item) => {
      if (item.game.franchise) {
        set.add(item.game.franchise.name);
      }
    });
    return Array.from(set).sort();
  }, [rawQueue]);

  // Filter queue
  const filteredQueue = useMemo(() => {
    return rawQueue.filter((item) => {
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && item.playing_status !== statusFilter) return false;
      if (franchiseFilter !== 'all') {
        const hasFranchise = item.game.franchise?.name === franchiseFilter;
        if (!hasFranchise) return false;
      }
      return true;
    });
  }, [rawQueue, priorityFilter, statusFilter, franchiseFilter]);

  const handleMove = async (entryId: string, direction: 'up' | 'down') => {
    try {
      await moveMutation.mutateAsync({ entryId, direction });
      addToast({
        tone: 'success',
        title: 'Queue Updated',
        message: `Moved game ${direction === 'up' ? 'up' : 'down'} in queue.`,
      });
    } catch {
      addToast({
        tone: 'error',
        title: 'Move Failed',
        message: 'Could not reorder queue position.',
      });
    }
  };

  const handleSetAsNext = async (entry: LibraryEntryRead) => {
    try {
      await setAsNextMutation.mutateAsync(entry.id);
      addToast({
        tone: 'accent',
        title: 'Promoted to Up Next',
        message: `"${entry.game.title}" is now #1 in your backlog queue!`,
      });
    } catch {
      addToast({
        tone: 'error',
        title: 'Promotion Failed',
        message: 'Could not promote game.',
      });
    }
  };

  const handleStatusChange = async (entryId: string, newStatus: PlayingStatus) => {
    try {
      await updateGameMutation.mutateAsync({
        entryId,
        updates: { playing_status: newStatus },
      });
      addToast({
        tone: 'success',
        title: 'Status Updated',
        message: `Moved to ${newStatus}.`,
      });
    } catch {
      addToast({
        tone: 'error',
        title: 'Update Failed',
        message: 'Could not update status.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-darker/60" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to Load Backlog"
          message="Could not retrieve your priority queue from SQLite database."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 pb-24">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-headline-xl font-bold tracking-tight text-on-background">
              Backlog Queue
            </h1>
            <Badge tone="accent" size="sm">
              {rawQueue.length} {rawQueue.length === 1 ? 'Game' : 'Games'}
            </Badge>
          </div>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Ranked priority queue for your active backlog and planned playthroughs.
          </p>
        </div>

        {/* View Switcher & Action */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-outline/70 bg-surface-darker/70 p-1">
            <button
              data-nav-item="true"
              onClick={() => setViewMode('queue')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
                viewMode === 'queue'
                  ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-background'
              }`}
            >
              <ListOrdered className="h-4 w-4" />
              Queue View
            </button>
            <button
              data-nav-item="true"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
                viewMode === 'board'
                  ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-background'
              }`}
            >
              <Kanban className="h-4 w-4" />
              Board View
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-outline/65 bg-surface-darker/60 p-4">
        <div className="flex items-center gap-2 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
          <SlidersHorizontal className="h-4 w-4 text-accent-primary" />
          Filters:
        </div>

        {/* Priority Filter */}
        <select
          data-nav-item="true"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-xl border border-outline/70 bg-surface-dark px-3 py-1.5 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="all">All Priorities</option>
          <option value="High">High Priority</option>
          <option value="Medium">Medium Priority</option>
          <option value="Low">Low Priority</option>
        </select>

        {/* Status Filter */}
        <select
          data-nav-item="true"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-outline/70 bg-surface-dark px-3 py-1.5 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="all">All Statuses</option>
          <option value="Planned">Planned</option>
          <option value="Currently Playing">Currently Playing</option>
          <option value="On Hold">On Hold</option>
          <option value="Completed">Completed</option>
        </select>

        {/* Franchise Filter */}
        {availableFranchises.length > 0 && (
          <select
            data-nav-item="true"
            value={franchiseFilter}
            onChange={(e) => setFranchiseFilter(e.target.value)}
            className="rounded-xl border border-outline/70 bg-surface-dark px-3 py-1.5 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
          >
            <option value="all">All Franchises</option>
            {availableFranchises.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}

        {(priorityFilter !== 'all' || statusFilter !== 'all' || franchiseFilter !== 'all') && (
          <Button
            data-nav-item="true"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPriorityFilter('all');
              setStatusFilter('all');
              setFranchiseFilter('all');
            }}
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      {viewMode === 'board' ? (
        /* ==================== KANBAN BOARD VIEW ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(
            [
              { status: 'Planned', title: 'Planned Backlog', tone: 'neutral' },
              { status: 'Currently Playing', title: 'Now Playing', tone: 'accent' },
              { status: 'On Hold', title: 'On Hold', tone: 'warning' },
              { status: 'Completed', title: 'Finished', tone: 'success' },
            ] as const
          ).map((col) => {
            const colItems = rawQueue.filter((i) => i.playing_status === col.status);
            return (
              <div
                key={col.status}
                className="flex flex-col rounded-2xl border border-outline/70 bg-surface-darker/60 p-4"
              >
                {/* Column Header */}
                <div className="mb-4 flex items-center justify-between border-b border-outline/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-headline text-headline-sm font-bold text-on-background">
                      {col.title}
                    </span>
                    <Badge tone={col.tone} size="sm">
                      {colItems.length}
                    </Badge>
                  </div>
                </div>

                {/* Cards List */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                  {colItems.length === 0 ? (
                    <div className="py-8 text-center text-body-sm text-on-surface-variant">
                      No games in this lane.
                    </div>
                  ) : (
                    colItems.map((item) => {
                      const coverArtwork = item.game.artworks?.find(
                        (a) => a.asset_type === 'cover',
                      );
                      const coverUrl = coverArtwork?.cached_url ?? coverArtwork?.remote_url;
                      return (
                        <div
                          key={item.id}
                          data-nav-item="true"
                          tabIndex={0}
                          className="group rounded-xl border border-outline/70 bg-secondary-background/90 p-3 transition-all hover:border-accent-primary/60 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-accent-primary"
                        >
                          <div className="flex gap-3">
                            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-dark">
                              {coverUrl ? (
                                <img
                                  src={coverUrl}
                                  alt={item.game.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
                                  <Gamepad2 className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4
                                className="font-headline text-body-md font-bold text-on-background truncate cursor-pointer hover:text-accent-primary"
                                onClick={() => navigate(buildGameDetailsRoute(item.id))}
                              >
                                {item.game.title}
                              </h4>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge
                                  tone={
                                    item.priority === 'High'
                                      ? 'accent'
                                      : item.priority === 'Medium'
                                      ? 'warning'
                                      : 'neutral'
                                  }
                                  size="sm"
                                >
                                  {item.priority}
                                </Badge>
                                {(item.hours_played ?? 0) > 0 && (
                                  <span className="text-caption text-on-surface-variant tabular-nums">
                                    {formatHoursLogged(item.hours_played ?? 0)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick lane transition buttons */}
                          <div className="mt-3 flex items-center justify-between border-t border-outline/50 pt-2 text-caption">
                            {col.status !== 'Currently Playing' && (
                              <button
                                data-nav-item="true"
                                onClick={() => handleStatusChange(item.id, 'Currently Playing')}
                                className="text-accent-primary hover:underline"
                              >
                                Play Now
                              </button>
                            )}
                            {col.status !== 'Completed' && (
                              <button
                                data-nav-item="true"
                                onClick={() => handleStatusChange(item.id, 'Completed')}
                                className="text-success hover:underline ml-auto"
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : filteredQueue.length === 0 ? (
        <EmptyState
          title="Backlog Queue is Empty"
          description={
            rawQueue.length > 0
              ? 'No games match the selected filters.'
              : 'Add games to your Planned or Currently Playing library to build your priority queue.'
          }
          actionLabel={rawQueue.length === 0 ? 'Explore Discover' : undefined}
          onAction={rawQueue.length === 0 ? () => navigate('/discover') : undefined}
        />
      ) : (
        /* ==================== QUEUE VIEW ==================== */
        <div className="space-y-3">
          {filteredQueue.map((item, index) => {
            const coverUrl = item.game.artworks?.find((a) => a.artwork_type === 'cover')?.url;
            const isFirst = index === 0;
            const isLast = index === filteredQueue.length - 1;

            return (
              <div
                key={item.id}
                data-nav-item="true"
                tabIndex={0}
                className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-outline/70 bg-secondary-background/85 p-4 transition-all duration-200 hover:border-accent-primary/60 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                {/* Left: Position & Cover & Details */}
                <div
                  className="flex items-center gap-4 cursor-pointer"
                  onClick={() => navigate(buildGameDetailsRoute(item.id))}
                >
                  {/* Position Badge */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline/70 bg-surface-dark font-headline text-headline-sm font-bold text-accent-primary tabular-nums">
                    #{index + 1}
                  </div>

                  {/* Cover Artwork */}
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-dark shadow-sm">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={item.game.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
                        <Gamepad2 className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* Title & Meta */}
                  <div>
                    <h3 className="font-headline text-headline-sm font-bold text-on-background group-hover:text-accent-primary transition-colors">
                      {item.game.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          item.priority === 'High'
                            ? 'accent'
                            : item.priority === 'Medium'
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {item.priority} Priority
                      </Badge>
                      <Badge tone="neutral" size="sm">
                        {item.playing_status}
                      </Badge>
                      {item.target_completion_date && (
                        <span className="flex items-center gap-1 text-caption text-on-surface-variant">
                          <Calendar className="h-3 w-3" />
                          Target: {formatShortDate(item.target_completion_date)}
                        </span>
                      )}
                      {(item.hours_played ?? 0) > 0 && (
                        <span className="text-caption text-on-surface-variant tabular-nums">
                          {formatHoursLogged(item.hours_played ?? 0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Controls & Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {/* Move Up / Down */}
                  <div className="flex items-center rounded-xl border border-outline/60 bg-surface-dark/80 p-1">
                    <button
                      data-nav-item="true"
                      disabled={isFirst || moveMutation.isPending}
                      onClick={() => handleMove(item.id, 'up')}
                      title="Move Up"
                      className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      data-nav-item="true"
                      disabled={isLast || moveMutation.isPending}
                      onClick={() => handleMove(item.id, 'down')}
                      title="Move Down"
                      className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Set as Next Game */}
                  {!isFirst && (
                    <Button
                      data-nav-item="true"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetAsNext(item)}
                      disabled={setAsNextMutation.isPending}
                      className="text-accent-primary hover:bg-accent-primary/10"
                    >
                      <Flame className="mr-1.5 h-3.5 w-3.5" />
                      Set as Next
                    </Button>
                  )}

                  {/* Quick Action: Start Playing */}
                  {item.playing_status !== 'Currently Playing' && (
                    <Button
                      data-nav-item="true"
                      variant="primary"
                      size="sm"
                      onClick={() => handleStatusChange(item.id, 'Currently Playing')}
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" />
                      Play Now
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
