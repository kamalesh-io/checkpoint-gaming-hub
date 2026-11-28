import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Eye, FolderKanban, SlidersHorizontal, Sparkles } from 'lucide-react';
import { GameCoverCard } from '@/components/game/GameCoverCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { GameCoverSkeleton } from '@/components/ui/Skeleton';
import { UpdateProgressModal } from '@/features/modals/UpdateProgressModal';
import { useLibraryQuery, useUpdateGameMutation } from '@/hooks/queries';
import { CONTROLLER_CUSTOM_EVENT } from '@/hooks/useSpatialNavigation';
import { ROUTES } from '@/routes/routes';
import type { ControllerActionEvent } from '@/services/gamepad/types';
import { useControllerStore } from '@/stores/controllerStore';
import { useLibraryStore, type LibrarySortMode } from '@/stores/libraryStore';
import { useToastStore } from '@/stores/toastStore';
import {
  OWNERSHIP_STATUSES,
  PLAYING_STATUSES,
  type LibraryEntryRead,
  type PlayingStatus,
} from '@/types';

/**
 * Overscan-safe 10-foot Big Picture Library supporting portrait grid navigation,
 * quick filters, franchise grouping, sorting, status changes, and dynamic theme feedback.
 */
export function BigPictureLibraryPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const setActiveEntryId = useControllerStore((s) => s.setBigPictureActiveEntryId);

  const statusFilter = useLibraryStore((s) => s.statusFilter);
  const ownershipFilter = useLibraryStore((s) => s.ownershipFilter);
  const groupByFranchise = useLibraryStore((s) => s.groupByFranchise);
  const sortBy = useLibraryStore((s) => s.sortBy);

  const setStatusFilter = useLibraryStore((s) => s.setStatusFilter);
  const setOwnershipFilter = useLibraryStore((s) => s.setOwnershipFilter);
  const setGroupByFranchise = useLibraryStore((s) => s.setGroupByFranchise);
  const setSortBy = useLibraryStore((s) => s.setSortBy);
  const resetFilters = useLibraryStore((s) => s.resetFilters);

  const libraryQuery = useLibraryQuery({ limit: 100 });
  const updateMutation = useUpdateGameMutation();

  const [focusedEntry, setFocusedEntry] = useState<LibraryEntryRead | null>(null);
  const [quickActionTarget, setQuickActionTarget] = useState<LibraryEntryRead | null>(null);
  const [progressTarget, setProgressTarget] = useState<LibraryEntryRead | null>(null);

  const allEntries = useMemo(
    () => (libraryQuery.data?.data ?? []).filter((e) => e.ownership_status !== 'To Buy'),
    [libraryQuery.data],
  );

  const filteredEntries = useMemo(() => {
    const matched = allEntries.filter((entry) => {
      if (statusFilter !== 'all' && entry.playing_status !== statusFilter) return false;
      if (ownershipFilter !== 'all' && entry.ownership_status !== ownershipFilter) return false;
      return true;
    });

    return matched.sort((a, b) => {
      if (sortBy === 'title_asc') return a.game.title.localeCompare(b.game.title);
      if (sortBy === 'progress_desc') return b.progress_pct - a.progress_pct;
      if (sortBy === 'rating_desc') return (b.personal_rating ?? -1) - (a.personal_rating ?? -1);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [allEntries, statusFilter, ownershipFilter, sortBy]);

  const franchiseGroups = useMemo(() => {
    if (!groupByFranchise) return null;
    const map = new Map<string, LibraryEntryRead[]>();
    for (const entry of filteredEntries) {
      const key = entry.game.franchise?.name || 'Standalone & Unlinked Titles';
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    }
    return Array.from(map.entries());
  }, [filteredEntries, groupByFranchise]);

  // X / Square opens quick actions on focused library card
  useEffect(() => {
    const onController = (ev: Event) => {
      const detail = (ev as CustomEvent<ControllerActionEvent>).detail;
      if (!detail || document.querySelector('[aria-modal="true"]')) return;
      if (detail.action === 'QUICK_ACTION' && focusedEntry) {
        ev.preventDefault();
        setQuickActionTarget(focusedEntry);
      }
    };
    window.addEventListener(CONTROLLER_CUSTOM_EVENT, onController);
    return () => window.removeEventListener(CONTROLLER_CUSTOM_EVENT, onController);
  }, [focusedEntry]);

  const handleQuickStatus = async (entry: LibraryEntryRead, status: PlayingStatus) => {
    try {
      await updateMutation.mutateAsync({
        entryId: entry.id,
        updates: { playing_status: status },
      });
      addToast({
        type: 'success',
        title: `${entry.game.title} marked ${status}`,
      });
      setQuickActionTarget(null);
    } catch {
      addToast({ type: 'error', title: 'Unable to update status' });
    }
  };

  const renderGrid = (items: LibraryEntryRead[]) => (
    <div
      data-nav-group="bp-library-grid"
      className="grid gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
    >
      {items.map((entry) => (
        <div
          key={entry.id}
          onFocusCapture={() => {
            setFocusedEntry(entry);
            setActiveEntryId(entry.id);
          }}
          onMouseEnter={() => {
            setFocusedEntry(entry);
            setActiveEntryId(entry.id);
          }}
        >
          <GameCoverCard
            entry={entry}
            size="large"
            onHover={(e) => {
              setFocusedEntry(e);
              setActiveEntryId(e.id);
            }}
            onOpenDetails={(e) => navigate(`${ROUTES.BIG_PICTURE}/games/${e.id}`)}
            onUpdateProgress={(e) => setProgressTarget(e)}
            onQuickStatusChange={(e, st) => void handleQuickStatus(e, st)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline/70 bg-secondary-background/80 backdrop-blur-md p-5">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-headline-lg text-on-background">Console Library</h1>
          <Badge tone="accent" size="md" className="tabular-nums">
            {filteredEntries.length}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3" data-nav-group="bp-filters">
          <Select
            aria-label="Filter Playing Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Statuses' },
              ...PLAYING_STATUSES.map((s) => ({ value: s, label: s })),
            ]}
          />
          <Select
            aria-label="Filter Ownership Status"
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Ownership' },
              ...OWNERSHIP_STATUSES.map((o) => ({ value: o, label: o })),
            ]}
          />
          <Select
            aria-label="Sort Console Library"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as LibrarySortMode)}
            options={[
              { value: 'recently_played', label: 'Recently Updated' },
              { value: 'title_asc', label: 'Title (A–Z)' },
              { value: 'progress_desc', label: 'Progress %' },
              { value: 'rating_desc', label: 'Personal Rating' },
            ]}
          />
          <Checkbox
            label="Franchise Shelves"
            checked={groupByFranchise}
            onChange={(e) => setGroupByFranchise(e.target.checked)}
          />
        </div>
      </div>

      {libraryQuery.isLoading ? (
        <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, idx) => (
            <GameCoverSkeleton key={idx} />
          ))}
        </div>
      ) : allEntries.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-8 w-8" />}
          title="Your Personal Library is Empty"
          description="Search IGDB in Big Picture Discover to import your games."
          actions={
            <Button
              variant="accent"
              size="lg"
              data-nav-primary="true"
              onClick={() => navigate(`${ROUTES.BIG_PICTURE}/discover`)}
            >
              Browse IGDB Catalog
            </Button>
          }
        />
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          compact
          icon={<Sparkles className="h-7 w-7" />}
          title="No Matching Games"
          description="Reset your library filters to view all imported titles."
          actions={
            <Button variant="secondary" onClick={resetFilters}>
              Reset Filters
            </Button>
          }
        />
      ) : franchiseGroups ? (
        <div className="space-y-8">
          {franchiseGroups.map(([name, groupItems]) => (
            <section key={name} className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-outline/60 pb-2">
                <FolderKanban className="h-5 w-5 text-accent-active" />
                <h2 className="font-headline text-headline-md text-on-background">{name}</h2>
                <Badge tone="neutral" size="sm" className="tabular-nums">
                  {groupItems.length}
                </Badge>
              </div>
              {renderGrid(groupItems)}
            </section>
          ))}
        </div>
      ) : (
        renderGrid(filteredEntries)
      )}

      {/* Controller Quick Actions Modal */}
      <Modal
        isOpen={Boolean(quickActionTarget)}
        onClose={() => setQuickActionTarget(null)}
        title={quickActionTarget?.game.title ?? 'Quick Actions'}
        subtitle="Select a quick action using D-Pad / A"
        size="sm"
      >
        {quickActionTarget && (
          <div className="space-y-2.5">
            <Button
              variant="accent"
              className="w-full justify-start"
              leftIcon={<Eye className="h-4 w-4" />}
              onClick={() => {
                const targetId = quickActionTarget.id;
                setQuickActionTarget(null);
                navigate(`${ROUTES.BIG_PICTURE}/games/${targetId}`);
              }}
            >
              Open Game Details
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              leftIcon={<SlidersHorizontal className="h-4 w-4" />}
              onClick={() => {
                const target = quickActionTarget;
                setQuickActionTarget(null);
                setProgressTarget(target);
              }}
            >
              Update Progress
            </Button>
            <div className="border-t border-outline/60 pt-2.5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted px-1">
                Quick Playing Status
              </p>
              {(['Currently Playing', 'Planned', 'Completed', 'On Hold'] as PlayingStatus[]).map(
                (st) => (
                  <Button
                    key={st}
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => void handleQuickStatus(quickActionTarget, st)}
                  >
                    Mark as {st}
                  </Button>
                ),
              )}
            </div>
          </div>
        )}
      </Modal>

      <UpdateProgressModal
        entry={progressTarget}
        isOpen={Boolean(progressTarget)}
        onClose={() => setProgressTarget(null)}
      />
    </div>
  );
}
