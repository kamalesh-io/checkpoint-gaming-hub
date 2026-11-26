import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Check,
  Clock,
  Gamepad2,
  List,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CompleteSessionModal } from '@/features/planner/CompleteSessionModal';
import { ScheduleSessionModal } from '@/features/planner/ScheduleSessionModal';
import {
  useDeletePlannerSessionMutation,
  usePlannerSessionsQuery,
} from '@/hooks/queries';
import { buildGameDetailsRoute } from '@/routes/routes';
import { useToastStore } from '@/stores/toastStore';
import type { ScheduledSessionRead } from '@/types';

type PlannerViewMode = 'list' | 'month' | 'timeline';

export function PlannerPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const [viewMode, setViewMode] = useState<PlannerViewMode>('list');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<ScheduledSessionRead | null>(null);

  const { data: sessions, isLoading, isError, refetch } = usePlannerSessionsQuery();
  const deleteMutation = useDeletePlannerSessionMutation();
  const [currentTimestamp] = useState(() => Date.now());

  const sortedSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort(
      (a, b) =>
        new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
    );
  }, [sessions]);

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      addToast({
        tone: 'neutral',
        title: 'Session Removed',
        message: 'Scheduled session deleted.',
      });
    } catch {
      addToast({
        tone: 'error',
        title: 'Delete Failed',
        message: 'Could not remove session.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-darker/60" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to Load Planner"
          message="Could not load your scheduled gaming sessions."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-headline-xl font-bold tracking-tight text-on-background">
              Gaming Planner & Calendar
            </h1>
            <Badge tone="accent" size="sm">
              {sortedSessions.length} {sortedSessions.length === 1 ? 'Session' : 'Sessions'}
            </Badge>
          </div>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Organize upcoming gaming sessions, track milestones, and maintain a dedicated schedule.
          </p>
        </div>

        {/* View mode toggle & Schedule button */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-outline/70 bg-surface-darker/70 p-1">
            <button
              data-nav-item="true"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-background'
              }`}
            >
              <List className="h-4 w-4" />
              Schedule List
            </button>
            <button
              data-nav-item="true"
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-background'
              }`}
            >
              <Clock className="h-4 w-4" />
              Timeline
            </button>
          </div>

          <Button
            data-nav-item="true"
            variant="primary"
            onClick={() => setIsScheduleModalOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Schedule Session
          </Button>
        </div>
      </div>

      {/* Main View Area */}
      {sortedSessions.length === 0 ? (
        <EmptyState
          title="No Scheduled Sessions"
          message="Plan your upcoming play sessions, boss fights, or multiplayer nights with custom target dates."
          actionLabel="Schedule Your First Session"
          onAction={() => setIsScheduleModalOpen(true)}
        />
      ) : viewMode === 'list' ? (
        /* ==================== LIST VIEW ==================== */
        <div className="space-y-3">
          {sortedSessions.map((session) => {
            const entry = session.library_entry;
            const coverArtwork = entry?.game.artworks?.find(
              (a) => a.asset_type === 'cover',
            );
            const coverUrl = coverArtwork?.cached_url ?? coverArtwork?.remote_url;
            const isCompleted = session.status === 'Completed';
            const startDate = new Date(session.scheduled_start);
            const isPast = startDate.getTime() < currentTimestamp && !isCompleted;

            return (
              <div
                key={session.id}
                data-nav-item="true"
                tabIndex={0}
                className={`group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-accent-primary ${
                  isCompleted
                    ? 'border-outline/40 bg-surface-dark/40 opacity-70'
                    : 'border-outline/70 bg-secondary-background/85 hover:border-accent-primary/60 hover:shadow-card'
                }`}
              >
                {/* Left: Info */}
                <div className="flex items-center gap-4">
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-dark shadow-sm">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={entry?.game.title ?? 'Cover'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
                        <Gamepad2 className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h3
                      className="font-headline text-headline-sm font-bold text-on-background cursor-pointer hover:text-accent-primary transition-colors"
                      onClick={() =>
                        entry && navigate(buildGameDetailsRoute(entry.id))
                      }
                    >
                      {entry?.game.title ?? 'Gaming Session'}
                    </h3>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-body-sm">
                      <span className="flex items-center gap-1 font-medium text-accent-primary">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {startDate.toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {startDate.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      <span className="text-on-surface-variant">•</span>
                      <span className="flex items-center gap-1 text-on-surface-variant">
                        <Clock className="h-3.5 w-3.5" />
                        {session.duration_minutes} mins
                      </span>

                      {session.repeat_schedule !== 'None' && (
                        <Badge tone="neutral" size="sm" className="flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          {session.repeat_schedule}
                        </Badge>
                      )}

                      <Badge
                        tone={
                          isCompleted
                            ? 'success'
                            : isPast
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {isCompleted ? 'Completed' : isPast ? 'Overdue' : session.status}
                      </Badge>
                    </div>

                    {session.notes && (
                      <p className="mt-1.5 text-body-sm text-on-surface-variant/90 italic">
                        "{session.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!isCompleted && (
                    <Button
                      data-nav-item="true"
                      variant="primary"
                      size="sm"
                      onClick={() => setCompleteTarget(session)}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Complete
                    </Button>
                  )}

                  <button
                    data-nav-item="true"
                    onClick={() => handleDelete(session.id)}
                    title="Remove session"
                    className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-elevated hover:text-error transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== TIMELINE VIEW ==================== */
        <div className="relative border-l-2 border-outline/70 pl-6 space-y-8 ml-4">
          {sortedSessions.map((session) => {
            const entry = session.library_entry;
            const startDate = new Date(session.scheduled_start);
            const isCompleted = session.status === 'Completed';

            return (
              <div key={session.id} className="relative group">
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    isCompleted
                      ? 'border-success bg-success'
                      : 'border-accent-primary bg-surface-darker'
                  }`}
                />

                <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-headline text-body-sm font-semibold text-accent-primary">
                      {startDate.toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      —{' '}
                      {startDate.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Badge tone={isCompleted ? 'success' : 'neutral'} size="sm">
                      {session.status}
                    </Badge>
                  </div>

                  <h3
                    className="mt-2 font-headline text-headline-sm font-bold text-on-background cursor-pointer hover:text-accent-primary"
                    onClick={() => entry && navigate(buildGameDetailsRoute(entry.id))}
                  >
                    {entry?.game.title ?? 'Gaming Session'}
                  </h3>

                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    Target duration: {session.duration_minutes} minutes
                    {session.notes ? ` • ${session.notes}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ScheduleSessionModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      <CompleteSessionModal
        session={completeTarget}
        isOpen={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
      />
    </div>
  );
}
