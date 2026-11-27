import { useMemo, useState, useEffect, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Compass,
  ExternalLink,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Star,
  WifiOff,
} from 'lucide-react';
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
import { buildGameDetailsRoute, ROUTES } from '@/routes/routes';
import { CheckpointApiError } from '@/services/api';
import { useAppStore } from '@/stores/appStore';
import type { IGDBSearchResultItem, OwnershipStatus } from '@/types';
import { cn } from '@/utils/cn';
import { formatIgdbRating, formatReleaseYear } from '@/utils/format';

const QUICK_SEARCH_TERMS = [
  'Elden Ring',
  'Cyberpunk 2077',
  'Hades II',
  'Metro Exodus',
  'Watch Dogs',
];

export function DiscoverPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';

  const globalSearchQuery = useAppStore((s) => s.globalSearchQuery);
  const setGlobalSearchQuery = useAppStore((s) => s.setGlobalSearchQuery);

  const [inputQuery, setInputQuery] = useState(() => urlQuery || globalSearchQuery || '');
  const [selectedIgdbId, setSelectedIgdbId] = useState<number | null>(null);
  const [modalTarget, setModalTarget] = useState<{
    item: IGDBSearchResultItem;
    defaultOwnership: OwnershipStatus;
  } | null>(null);

  // Synchronize external global titlebar ?q= changes cleanly
  const [lastSyncedUrlQ, setLastSyncedUrlQ] = useState(urlQuery);
  if (urlQuery !== lastSyncedUrlQ) {
    setLastSyncedUrlQ(urlQuery);
    setInputQuery(urlQuery);
    setGlobalSearchQuery(urlQuery);
  }

  // If page opened with no ?q= but globalSearchQuery exists, initialize URL
  useEffect(() => {
    if (!urlQuery && globalSearchQuery.trim()) {
      setSearchParams({ q: globalSearchQuery.trim() }, { replace: true });
    }
  }, [urlQuery, globalSearchQuery, setSearchParams]);

  const debouncedQuery = useDebounce(inputQuery, 300);
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

  const handleSearchChange = (value: string) => {
    setInputQuery(value);
    setGlobalSearchQuery(value);
    if (value.trim()) {
      setSearchParams({ q: value }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (results.length === 0) return;
    const idx = results.findIndex((r) => r.igdb_id === activeResult?.igdb_id);
    const safeIdx = idx >= 0 ? idx : 0;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = results[(safeIdx + 1) % results.length];
      if (next) setSelectedIgdbId(next.igdb_id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = results[(safeIdx - 1 + results.length) % results.length];
      if (prev) setSelectedIgdbId(prev.igdb_id);
    }
  };

  const renderSearchError = () => {
    const err = searchQuery.error;
    if (err instanceof CheckpointApiError && err.isRateLimitError) {
      return (
        <ErrorState
          variant="warning"
          title="IGDB Rate Limit Reached"
          message="Too many search requests in quick succession. Wait a second and retry."
          onRetry={() => void searchQuery.refetch()}
        />
      );
    }

    const isOfflineOrDns =
      err instanceof CheckpointApiError &&
      (err.code === 'DNS_RESOLUTION_FAILED' ||
        err.code === 'OFFLINE_NO_INTERNET' ||
        err.code === 'IGDB_SERVICE_UNREACHABLE' ||
        err.code.includes('TIMEOUT') ||
        err.message.includes('11001') ||
        err.message.includes('getaddrinfo'));

    if (isOfflineOrDns) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-outline/30 bg-surface/50 p-8 text-center max-w-xl mx-auto my-6 space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/15 text-warning border border-warning/30">
            <WifiOff className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-headline text-headline-sm text-on-surface">
              Unable to reach IGDB catalog
            </h3>
            <p className="text-body-sm text-muted mt-1.5 leading-relaxed">
              {err instanceof CheckpointApiError
                ? err.message
                : 'Unable to reach the IGDB catalog. Check your internet connection or DNS settings. Your local library remains fully accessible offline.'}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="secondary"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              onClick={() => void searchQuery.refetch()}
            >
              Retry Search
            </Button>
            <Button
              variant="accent"
              onClick={() => navigate(ROUTES.LIBRARY)}
            >
              Browse Local Library
            </Button>
          </div>
        </div>
      );
    }

    return (
      <ErrorState
        title="Unable to search IGDB"
        message={
          err instanceof CheckpointApiError
            ? err.message
            : 'External metadata service unavailable or network offline.'
        }
        onRetry={() => void searchQuery.refetch()}
      />
    );
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header + Search Input */}
      <div className="space-y-4">
        <div>
          <h1 className="font-headline text-headline-lg text-on-background">
            Discover & Import Games
          </h1>
          <p className="text-body-md text-muted mt-0.5">
            Search IGDB with base-game prioritization and preview SteamGridDB metadata before
            adding to your local library.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="w-full max-w-2xl">
            <SearchInput
              value={inputQuery}
              onValueChange={handleSearchChange}
              isLoading={searchQuery.isFetching}
              placeholder="Search IGDB catalog (e.g., Elden Ring, Metro Exodus, Hades II)..."
              className="h-11 bg-secondary-background/95"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_SEARCH_TERMS.map((term) => (
              <button
                key={term}
                type="button"
                data-nav-item="true"
                onClick={() => handleSearchChange(term)}
                className="rounded-full border border-outline/75 bg-surface/65 px-3 py-1.5 text-label-sm text-muted hover:text-on-background hover:border-accent-active/60 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split States */}
      {debouncedQuery.trim().length < 2 ? (
        <EmptyState
          icon={<Compass className="h-7 w-7" />}
          title="Search Millions of IGDB Titles"
          description="Type at least 2 characters above to search live IGDB records, inspect screenshots and release details, or import titles into your personal library and wishlist."
        />
      ) : searchQuery.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="space-y-3 min-w-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[520px] w-full rounded-2xl min-w-0" />
        </div>
      ) : searchQuery.isError ? (
        renderSearchError()
      ) : results.length === 0 ? (
        <EmptyState
          compact
          title={`No IGDB results for "${debouncedQuery.trim()}"`}
          description="Try checking spelling or searching the base franchise title without edition suffixes."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
          {/* Left Column: IGDB Results List */}
          <div
            onKeyDown={handleListKeyDown}
            className="space-y-2.5 min-w-0"
            aria-label="IGDB search results"
          >
            <div className="flex items-center justify-between px-1 text-body-sm text-muted">
              <span>
                Showing <strong className="text-on-surface tabular-nums">{results.length}</strong>{' '}
                matches (base titles prioritized)
              </span>
              <span className="hidden sm:inline text-[12px]">Use ↑ / ↓ arrows to preview</span>
            </div>

            {results.map((item) => {
              const isSelected = activeResult?.igdb_id === item.igdb_id;
              const ratingText = formatIgdbRating(item.igdb_rating);

              return (
                <div
                  key={item.igdb_id}
                  role="button"
                  tabIndex={0}
                  data-nav-item="true"
                  aria-selected={isSelected}
                  onClick={() => setSelectedIgdbId(item.igdb_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedIgdbId(item.igdb_id);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-4 rounded-xl border p-3 transition-all cursor-pointer',
                    isSelected
                      ? 'border-accent-active bg-surface-elevated/90 checkpoint-accent-glow'
                      : 'border-outline/70 bg-secondary-background/80 hover:border-outline hover:bg-surface/65',
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
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <h3 className="font-headline text-headline-sm text-on-background truncate min-w-0 max-w-full">
                        {item.title}
                      </h3>
                      {item.category && item.category !== 'Main Game' && (
                        <Badge tone="outline" size="sm" className="shrink-0">
                          {item.category}
                        </Badge>
                      )}
                      {item.in_library && (
                        <Badge
                          tone="success"
                          size="sm"
                          className="shrink-0"
                          leftIcon={<CheckCircle2 className="h-3 w-3" />}
                        >
                          In Library
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted">
                      <span>{item.release_year ?? 'TBA'}</span>
                      {item.developer && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[180px]">{item.developer}</span>
                        </>
                      )}
                      {ratingText && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-accent-gold font-semibold tabular-nums">
                            <Star className="h-3.5 w-3.5 fill-accent-gold" />
                            {ratingText}
                          </span>
                        </>
                      )}
                    </div>

                    {item.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {item.genres.slice(0, 3).map((genre) => (
                          <span
                            key={genre}
                            className="rounded bg-background/60 px-1.5 py-0.5 text-[11px] text-muted"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    {item.in_library && item.library_entry_id ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                        onClick={() => navigate(buildGameDetailsRoute(item.library_entry_id!))}
                      >
                        Open
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="accent"
                        leftIcon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() =>
                          setModalTarget({ item, defaultOwnership: 'Unknown' })
                        }
                      >
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Sticky Game Preview Panel */}
          {activeResult && (
            <aside className="lg:sticky lg:top-4 rounded-2xl border border-outline/75 bg-secondary-background/90 overflow-hidden shadow-modal">
              {/* Backdrop Banner */}
              <div className="relative h-52 w-full overflow-hidden bg-background">
                <GameArtwork
                  src={details?.hero_url ?? details?.screenshots[0] ?? activeResult.cover_url}
                  alt={activeResult.title}
                  aspect="landscape"
                  className="h-full w-full"
                  showTitleOnFallback={false}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary-background via-secondary-background/55 to-transparent" />
              </div>

              <div className="relative -mt-16 px-6 pb-6 space-y-5">
                <div className="flex items-end gap-4">
                  <div className="w-24 shrink-0 overflow-hidden rounded-xl border-2 border-outline shadow-modal">
                    <GameArtwork
                      src={details?.cover_url ?? activeResult.cover_url}
                      alt={activeResult.title}
                      aspect="portrait"
                      className="w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <h2 className="font-headline text-headline-md text-on-background leading-tight">
                      {details?.title ?? activeResult.title}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-body-sm text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {details?.release_date
                          ? formatReleaseYear(details.release_date)
                          : activeResult.release_year ?? 'TBA'}
                      </span>
                      {(details?.igdb_rating ?? activeResult.igdb_rating) && (
                        <span className="inline-flex items-center gap-1 text-accent-gold font-semibold tabular-nums">
                          <Star className="h-3.5 w-3.5 fill-accent-gold" />
                          {formatIgdbRating(details?.igdb_rating ?? activeResult.igdb_rating)} IGDB
                          {details?.igdb_rating_count ? ` (${details.igdb_rating_count})` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action CTAs */}
                <div className="flex flex-wrap gap-2.5">
                  {activeResult.in_library && activeResult.library_entry_id ? (
                    <Button
                      variant="accent"
                      className="flex-1"
                      leftIcon={<ExternalLink className="h-4 w-4" />}
                      onClick={() =>
                        navigate(buildGameDetailsRoute(activeResult.library_entry_id!))
                      }
                    >
                      Open in My Library
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="accent"
                        className="flex-1"
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={() =>
                          setModalTarget({
                            item: activeResult,
                            defaultOwnership: 'Unknown',
                          })
                        }
                      >
                        Add to Library
                      </Button>
                      <Button
                        variant="secondary"
                        leftIcon={<ShoppingBag className="h-4 w-4" />}
                        onClick={() =>
                          setModalTarget({
                            item: activeResult,
                            defaultOwnership: 'To Buy',
                          })
                        }
                      >
                        Add to Wishlist
                      </Button>
                    </>
                  )}
                </div>

                {detailsQuery.isLoading ? (
                  <div className="space-y-2.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-outline/65 bg-surface/45 p-3.5 text-body-sm">
                      <div>
                        <span className="text-muted block text-[11px] uppercase">Developer</span>
                        <span className="text-on-surface font-medium">
                          {details?.developer ?? activeResult.developer ?? 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted block text-[11px] uppercase">Publisher</span>
                        <span className="text-on-surface font-medium">
                          {details?.publisher ?? activeResult.publisher ?? 'Unknown'}
                        </span>
                      </div>
                      {details?.franchise_name && (
                        <div className="col-span-2">
                          <span className="text-muted block text-[11px] uppercase">Franchise</span>
                          <span className="text-accent-active font-medium inline-flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5" />
                            {details.franchise_name}
                          </span>
                        </div>
                      )}
                    </div>

                    {details?.summary && (
                      <p className="text-body-sm text-on-surface/85 leading-relaxed line-clamp-5">
                        {details.summary}
                      </p>
                    )}

                    {(details?.genres.length ?? activeResult.genres.length) > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(details?.genres.map((g) => g.name) ?? activeResult.genres).map(
                          (genre) => (
                            <Badge key={genre} tone="outline" size="sm">
                              {genre}
                            </Badge>
                          ),
                        )}
                      </div>
                    )}

                    {details && details.screenshots.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-label-sm text-muted">
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>IGDB Screenshots</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {details.screenshots.slice(0, 3).map((shot) => (
                            <GameArtwork
                              key={shot}
                              src={shot}
                              alt={`${details.title} screenshot`}
                              aspect="landscape"
                              className="rounded-lg border border-outline/60"
                              showTitleOnFallback={false}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Add Game Modal */}
      <AddGameModal
        isOpen={Boolean(modalTarget)}
        onClose={() => setModalTarget(null)}
        searchResult={modalTarget?.item ?? null}
        details={
          modalTarget?.item.igdb_id === details?.igdb_id ? details : undefined
        }
        defaultOwnershipStatus={modalTarget?.defaultOwnership ?? 'Unknown'}
        onAdded={(created) => navigate(buildGameDetailsRoute(created.id))}
        onOpenExisting={(entryId) => navigate(buildGameDetailsRoute(entryId))}
      />
    </div>
  );
}
