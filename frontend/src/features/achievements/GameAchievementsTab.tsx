import { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useGameAchievementsQuery,
  useSyncAchievementsMutation,
} from '@/hooks/queries/usePhase6Queries';
import { useToastStore } from '@/stores/toastStore';
import { cn } from '@/utils/cn';
import { formatShortDate } from '@/utils/format';

interface GameAchievementsTabProps {
  gameId: string;
  gameTitle: string;
  steamAppId?: number | null;
  onSuggestCompletion?: () => void;
}

export function GameAchievementsTab({
  gameId,
  gameTitle,
  steamAppId,
  onSuggestCompletion,
}: GameAchievementsTabProps) {
  const { data, isLoading, isError, refetch } = useGameAchievementsQuery(gameId);
  const syncMutation = useSyncAchievementsMutation(gameId);
  const addToast = useToastStore((s) => s.addToast);

  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const handleRefresh = async () => {
    try {
      await syncMutation.mutateAsync();
      addToast({
        title: 'Achievements Synchronized',
        description: 'Successfully refreshed achievement progress from Steam.',
        tone: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Sync Failed',
        description: err instanceof Error ? err.message : 'Could not reach Steam Web API.',
        tone: 'error',
      });
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 rounded-2xl border border-outline/75 bg-secondary-background/80 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <div className="grid gap-3 pt-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data || !data.is_available) {
    return (
      <div className="rounded-2xl border border-outline/75 bg-secondary-background/80 p-8">
        <EmptyState
          icon={<Trophy className="h-8 w-8 text-muted" />}
          title="Steam Achievements Unavailable"
          description={
            data?.message ||
            (steamAppId
              ? `Steam App ID #${steamAppId} has no public achievements or profile privacy settings restrict access.`
              : 'This title is not linked to a Steam App ID. Link a Steam App ID or configure Steam in Settings to view achievements.')
          }
          actions={
            steamAppId ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={() => refetch()}
                data-nav-item="true"
              >
                Retry
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (data.total_count === 0) {
    return (
      <div className="rounded-2xl border border-outline/75 bg-secondary-background/80 p-8">
        <EmptyState
          icon={<Trophy className="h-8 w-8 text-muted" />}
          title="No Achievements for this Title"
          description={`Steam does not report any registered achievements for ${gameTitle}.`}
        />
      </div>
    );
  }

  const allAchievements = data.achievements || [];
  const filteredAchievements = allAchievements.filter((item) => {
    if (filter === 'unlocked' && !item.unlocked) return false;
    if (filter === 'locked' && item.unlocked) return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = item.display_name.toLowerCase().includes(query);
      const matchesDesc = (item.description || '').toLowerCase().includes(query);
      return matchesName || matchesDesc;
    }
    return true;
  });

  const recentlyUnlocked = allAchievements
    .filter((a) => a.unlocked && a.unlock_time)
    .sort((a, b) => new Date(b.unlock_time!).getTime() - new Date(a.unlock_time!).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* 100% Completion Suggestion Alert */}
      {data.completion_suggestion && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-accent-gold/40 bg-accent-gold/10 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-gold/20 text-accent-gold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-headline text-body-md font-bold text-on-background">
                100% Steam Achievements Unlocked!
              </h4>
              <p className="text-body-sm text-muted">
                You have unlocked every achievement for this game. Would you like to mark your personal status as 100% Completed?
              </p>
            </div>
          </div>
          {onSuggestCompletion && (
            <Button
              variant="accent"
              size="sm"
              onClick={onSuggestCompletion}
              data-nav-item="true"
            >
              Set 100% Completed
            </Button>
          )}
        </div>
      )}

      {/* Header Metric Card */}
      <section className="rounded-2xl border border-outline/75 bg-secondary-background/80 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-headline text-headline-md text-on-background flex items-center gap-2.5">
              <Trophy className="h-5 w-5 text-accent-primary" />
              Achievements Progress
            </h3>
            <p className="text-body-sm text-muted">
              {data.unlocked_count} of {data.total_count} unlocked ({data.completion_pct}%)
              {data.last_synced_at && (
                <span className="ml-2 text-xs text-muted/70">
                  • Synced {formatShortDate(data.last_synced_at)}
                </span>
              )}
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={
              <RefreshCw
                className={cn('h-4 w-4', syncMutation.isPending && 'animate-spin')}
              />
            }
            onClick={handleRefresh}
            disabled={syncMutation.isPending}
            data-nav-item="true"
          >
            {syncMutation.isPending ? 'Syncing...' : 'Refresh from Steam'}
          </Button>
        </div>

        <ProgressBar
          value={data.completion_pct}
          height="md"
        />

        {/* Recently Unlocked Shelf */}
        {recentlyUnlocked.length > 0 && (
          <div className="pt-2 border-t border-outline/50 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Recently Unlocked
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recentlyUnlocked.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-outline/60 bg-surface-darker/60 p-3"
                >
                  <img
                    src={item.icon_url || item.icon_gray_url || ''}
                    alt={item.display_name}
                    className="h-10 w-10 shrink-0 rounded-lg object-cover bg-surface-dark"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-body-sm text-on-background">
                      {item.display_name}
                    </p>
                    <p className="text-xs text-muted">
                      {item.unlock_time ? formatShortDate(item.unlock_time) : 'Unlocked'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'accent' : 'secondary'}
            size="sm"
            onClick={() => setFilter('all')}
            data-nav-item="true"
          >
            All ({data.total_count})
          </Button>
          <Button
            variant={filter === 'unlocked' ? 'accent' : 'secondary'}
            size="sm"
            onClick={() => setFilter('unlocked')}
            data-nav-item="true"
          >
            Unlocked ({data.unlocked_count})
          </Button>
          <Button
            variant={filter === 'locked' ? 'accent' : 'secondary'}
            size="sm"
            onClick={() => setFilter('locked')}
            data-nav-item="true"
          >
            Locked ({data.total_count - data.unlocked_count})
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search achievements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-outline/80 bg-surface-darker/90 py-2 pl-9 pr-3 text-body-sm text-on-background placeholder:text-muted focus:border-accent-primary focus:outline-none"
            data-nav-item="true"
          />
        </div>
      </div>

      {/* Achievements Catalog Grid */}
      <div className="grid gap-3">
        {filteredAchievements.length === 0 ? (
          <div className="rounded-2xl border border-outline/60 bg-secondary-background/60 p-8 text-center text-muted">
            No achievements match your current filter or search query.
          </div>
        ) : (
          filteredAchievements.map((item) => {
            const isHiddenLocked = item.is_hidden && !item.unlocked;
            const isRevealed = revealedIds.has(item.id);

            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-start sm:items-center justify-between gap-4 rounded-xl border p-4 transition-all',
                  item.unlocked
                    ? 'border-outline/75 bg-secondary-background/90 shadow-sm'
                    : 'border-outline/40 bg-surface-darker/40 opacity-80',
                )}
                data-nav-item="true"
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-dark border border-outline/60">
                    <img
                      src={
                        item.unlocked
                          ? item.icon_url || item.icon_gray_url || ''
                          : item.icon_gray_url || item.icon_url || ''
                      }
                      alt={item.display_name}
                      className={cn(
                        'h-full w-full object-cover',
                        !item.unlocked && 'grayscale opacity-60',
                      )}
                    />
                    {!item.unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Lock className="h-4 w-4 text-white/80" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={cn(
                          'font-semibold text-body-md text-on-background',
                          isHiddenLocked && !isRevealed && 'blur-sm select-none',
                        )}
                      >
                        {item.display_name}
                      </h4>
                      {item.unlocked && (
                        <Badge tone="success" size="sm">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Unlocked
                        </Badge>
                      )}
                      {item.is_hidden && (
                        <Badge tone="neutral" size="sm">
                          Hidden
                        </Badge>
                      )}
                    </div>

                    <p
                      className={cn(
                        'text-body-sm text-muted',
                        isHiddenLocked && !isRevealed && 'blur-sm select-none',
                      )}
                    >
                      {item.description || 'Hidden achievement.'}
                    </p>

                    {item.unlocked && item.unlock_time && (
                      <p className="text-xs text-muted/70">
                        Unlocked on {formatShortDate(item.unlock_time)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Column: Global Percentage & Spoiler Toggle */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
                  {item.global_percentage !== null && item.global_percentage !== undefined && (
                    <Badge tone="neutral" size="sm">
                      {item.global_percentage}% of players
                    </Badge>
                  )}

                  {isHiddenLocked && (
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={
                        isRevealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )
                      }
                      onClick={() => toggleReveal(item.id)}
                      data-nav-item="true"
                    >
                      {isRevealed ? 'Hide Spoiler' : 'Reveal'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
