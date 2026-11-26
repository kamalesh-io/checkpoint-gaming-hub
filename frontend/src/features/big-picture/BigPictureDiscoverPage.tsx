import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Compass, ExternalLink, Keyboard, Plus, ShoppingBag, Star } from 'lucide-react';
import { GameArtwork } from '@/components/game/GameArtwork';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { AddGameModal } from '@/features/modals/AddGameModal';
import { useIgdbGameDetailsQuery, useIgdbSearchQuery } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { CONTROLLER_CUSTOM_EVENT } from '@/hooks/useSpatialNavigation';
import { ROUTES } from '@/routes/routes';
import type { ControllerActionEvent } from '@/services/gamepad/types';
import { useControllerStore } from '@/stores/controllerStore';
import type { IGDBSearchResultItem, OwnershipStatus } from '@/types';
import { cn } from '@/utils/cn';
import { formatIgdbRating, formatReleaseYear } from '@/utils/format';

/**
 * Controller-friendly IGDB Discovery & Import screen with On-Screen Virtual Keyboard support.
 */
export function BigPictureDiscoverPage() {
  const navigate = useNavigate();
  const openVirtualKeyboard = useControllerStore((s) => s.openVirtualKeyboard);

  const [queryText, setQueryText] = useState('');
  const [selectedIgdbId, setSelectedIgdbId] = useState<number | null>(null);
  const [modalTarget, setModalTarget] = useState<{
    item: IGDBSearchResultItem;
    defaultOwnership: OwnershipStatus;
  } | null>(null);

  const debouncedQuery = useDebounce(queryText, 350);
  const searchQuery = useIgdbSearchQuery(debouncedQuery, 15);
  const results = useMemo(() => searchQuery.data?.data ?? [], [searchQuery.data]);

  const activeResult = useMemo(() => {
    if (results.length === 0) return null;
    if (selectedIgdbId !== null) {
      const hit = results.find((r) => r.igdb_id === selectedIgdbId);
      if (hit) return hit;
    }
    return results[0] ?? null;
  }, [results, selectedIgdbId]);

  const detailsQuery = useIgdbGameDetailsQuery(activeResult?.igdb_id ?? null);
  const details = detailsQuery.data ?? null;

  const launchSearchKeyboard = () => {
    openVirtualKeyboard({
      id: 'bp-discover-search',
      label: 'Search IGDB Game Catalog',
      initialValue: queryText,
      placeholder: 'Type game title (e.g., Elden Ring, Hades II)...',
      onChange: (val) => setQueryText(val),
      onSubmit: (val) => setQueryText(val),
    });
  };

  // Y / Triangle opens search keyboard; X / Square opens Add to Wishlist on active preview
  useEffect(() => {
    const onController = (ev: Event) => {
      const detail = (ev as CustomEvent<ControllerActionEvent>).detail;
      if (!detail || document.querySelector('[aria-modal="true"]')) return;

      if (detail.action === 'SEARCH') {
        ev.preventDefault();
        openVirtualKeyboard({
          id: 'bp-discover-search',
          label: 'Search IGDB Game Catalog',
          initialValue: queryText,
          placeholder: 'Type game title...',
          onChange: (val) => setQueryText(val),
          onSubmit: (val) => setQueryText(val),
        });
      } else if (detail.action === 'QUICK_ACTION' && activeResult && !activeResult.in_library) {
        ev.preventDefault();
        setModalTarget({ item: activeResult, defaultOwnership: 'To Buy' });
      }
    };
    window.addEventListener(CONTROLLER_CUSTOM_EVENT, onController);
    return () => window.removeEventListener(CONTROLLER_CUSTOM_EVENT, onController);
  }, [activeResult, openVirtualKeyboard, queryText]);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-outline/75 bg-secondary-background/85 backdrop-blur-md p-5">
        <div className="flex-1 min-w-[260px]">
          <SearchInput
            value={queryText}
            onValueChange={setQueryText}
            isLoading={searchQuery.isFetching}
            placeholder="Search IGDB catalog..."
            aria-label="Big Picture IGDB Search"
            className="h-12 bg-background/80 text-body-lg"
          />
        </div>
        <Button
          variant="accent"
          size="lg"
          data-nav-primary="true"
          leftIcon={<Keyboard className="h-4 w-4" />}
          onClick={launchSearchKeyboard}
        >
          On-Screen Keyboard
        </Button>
      </div>

      {debouncedQuery.trim().length < 2 ? (
        <EmptyState
          icon={<Compass className="h-8 w-8" />}
          title="Search the IGDB Database"
          description="Use the On-Screen Keyboard or your physical keyboard to find games, preview artwork, and import directly to your Library or Wishlist."
          actions={
            <Button
              variant="accent"
              size="lg"
              leftIcon={<Keyboard className="h-4 w-4" />}
              onClick={launchSearchKeyboard}
            >
              Open Virtual Keyboard
            </Button>
          }
        />
      ) : searchQuery.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[460px] rounded-2xl" />
        </div>
      ) : searchQuery.isError ? (
        <ErrorState
          title="IGDB Search Unavailable"
          message="Check your network connection or DPAPI credentials in Settings."
          onRetry={() => void searchQuery.refetch()}
        />
      ) : results.length === 0 ? (
        <EmptyState
          compact
          title={`No Results for "${debouncedQuery.trim()}"`}
          description="Try another query or edit with the On-Screen Keyboard."
          actions={
            <Button variant="secondary" onClick={launchSearchKeyboard}>
              Edit Search Text
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-start">
          <div
            className="space-y-2.5 max-h-[calc(100vh-295px)] overflow-y-auto pr-1.5 min-w-0"
            data-nav-group="bp-discover-results"
          >
            {results.map((item) => {
              const isSelected = activeResult?.igdb_id === item.igdb_id;
              return (
                <button
                  key={item.igdb_id}
                  type="button"
                  data-nav-item="true"
                  data-nav-group="bp-discover-results"
                  onFocus={() => setSelectedIgdbId(item.igdb_id)}
                  onClick={() => {
                    if (isSelected) {
                      if (item.in_library && item.library_entry_id) {
                        navigate(`${ROUTES.BIG_PICTURE}/games/${item.library_entry_id}`);
                      } else {
                        setModalTarget({ item, defaultOwnership: 'Unknown' });
                      }
                    } else {
                      setSelectedIgdbId(item.igdb_id);
                    }
                  }}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-xl border p-3.5 text-left transition-all',
                    isSelected
                      ? 'border-accent-active bg-surface-elevated/95 checkpoint-accent-glow'
                      : 'border-outline/70 bg-secondary-background/85 hover:bg-surface/75',
                  )}
                >
                  <GameArtwork
                    src={item.cover_url}
                    alt={item.title}
                    aspect="portrait"
                    className="w-16 rounded-lg shrink-0"
                    showTitleOnFallback={false}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-headline text-headline-sm text-on-background truncate">
                        {item.title}
                      </span>
                      {item.in_library && (
                        <Badge tone="success" size="sm" leftIcon={<CheckCircle2 className="h-3 w-3" />}>
                          In Library
                        </Badge>
                      )}
                    </div>
                    <p className="text-body-sm text-muted">
                      {item.release_year ?? 'TBA'}
                      {item.developer ? ` · ${item.developer}` : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {activeResult && (
            <div className="rounded-2xl border border-outline/75 bg-secondary-background/90 backdrop-blur-md p-5 space-y-4 shadow-modal md:sticky md:top-0 min-w-0">
              <div className="flex items-end gap-4">
                <div className="w-28 shrink-0 overflow-hidden rounded-xl border border-outline">
                  <GameArtwork
                    src={details?.cover_url ?? activeResult.cover_url}
                    alt={activeResult.title}
                    aspect="portrait"
                    className="w-full"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="font-headline text-headline-md text-on-background">
                    {details?.title ?? activeResult.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted">
                    <span>
                      {details?.release_date
                        ? formatReleaseYear(details.release_date)
                        : activeResult.release_year ?? 'TBA'}
                    </span>
                    {(details?.igdb_rating ?? activeResult.igdb_rating) && (
                      <span className="inline-flex items-center gap-1 text-accent-gold font-semibold tabular-nums">
                        <Star className="h-3.5 w-3.5 fill-accent-gold" />
                        {formatIgdbRating(details?.igdb_rating ?? activeResult.igdb_rating)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {details?.summary && (
                <p className="text-body-md text-on-surface/85 line-clamp-5 leading-relaxed">
                  {details.summary}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                {activeResult.in_library && activeResult.library_entry_id ? (
                  <Button
                    variant="accent"
                    size="lg"
                    className="flex-1"
                    leftIcon={<ExternalLink className="h-4 w-4" />}
                    onClick={() =>
                      navigate(`${ROUTES.BIG_PICTURE}/games/${activeResult.library_entry_id}`)
                    }
                  >
                    Open Game Details
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="accent"
                      size="lg"
                      className="flex-1"
                      leftIcon={<Plus className="h-4 w-4" />}
                      onClick={() =>
                        setModalTarget({ item: activeResult, defaultOwnership: 'Unknown' })
                      }
                    >
                      Add to Library
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      leftIcon={<ShoppingBag className="h-4 w-4" />}
                      onClick={() =>
                        setModalTarget({ item: activeResult, defaultOwnership: 'To Buy' })
                      }
                    >
                      Add to Wishlist
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <AddGameModal
        isOpen={Boolean(modalTarget)}
        onClose={() => setModalTarget(null)}
        searchResult={modalTarget?.item ?? null}
        details={modalTarget?.item.igdb_id === details?.igdb_id ? details : undefined}
        defaultOwnershipStatus={modalTarget?.defaultOwnership ?? 'Unknown'}
        onAdded={(created) => navigate(`${ROUTES.BIG_PICTURE}/games/${created.id}`)}
        onOpenExisting={(entryId) => navigate(`${ROUTES.BIG_PICTURE}/games/${entryId}`)}
      />
    </div>
  );
}
