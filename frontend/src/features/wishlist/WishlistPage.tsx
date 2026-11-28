import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Compass,
  Edit2,
  ExternalLink,
  Filter,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { EditWishlistModal } from './EditWishlistModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useConvertWishlistToLibraryMutation,
  useDeleteWishlistItemMutation,
  useLibraryQuery,
  useRemoveGameMutation,
  useUpdateGameMutation,
  useWishlistQuery,
} from '@/hooks/queries';
import {
  useRefreshPricesMutation,
  useWishlistPricesQuery,
} from '@/hooks/queries/usePhase6Queries';
import { buildGameDetailsRoute, ROUTES } from '@/routes/routes';
import { useToastStore } from '@/stores/toastStore';
import type { LibraryEntryRead, PriceInfoItem, WishlistItemRead } from '@/types';

export function WishlistPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const inBigPicture = location.pathname.startsWith(ROUTES.BIG_PICTURE);
  const detailsRoute = (id: string) =>
    inBigPicture ? `${ROUTES.BIG_PICTURE}/games/${id}` : buildGameDetailsRoute(id);
  const discoverRoute = inBigPicture ? `${ROUTES.BIG_PICTURE}/discover` : ROUTES.DISCOVER;
  const addToast = useToastStore((s) => s.addToast);

  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [convertTarget, setConvertTarget] = useState<WishlistItemRead | null>(null);
  const [editTarget, setEditTarget] = useState<WishlistItemRead | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('PC');
  const [selectedStatus, setSelectedStatus] = useState<string>('Planned');

  const { data: dedicatedWishlist, isLoading: isWishLoading, isError: isWishError, refetch } =
    useWishlistQuery();
  const { data: legacyLibrary } = useLibraryQuery({ ownership_status: 'To Buy', limit: 100 });

  const deleteWishlistMutation = useDeleteWishlistItemMutation();
  const convertMutation = useConvertWishlistToLibraryMutation();
  const updateLibraryMutation = useUpdateGameMutation();
  const removeLibraryMutation = useRemoveGameMutation();

  const { data: pricesData } = useWishlistPricesQuery();
  const refreshPricesMutation = useRefreshPricesMutation();

  const priceMap = useMemo(() => {
    const map = new Map<string, PriceInfoItem>();
    if (pricesData?.items) {
      pricesData.items.forEach((p) => map.set(p.game_id, p));
    }
    return map;
  }, [pricesData]);

  const dedicatedItems = useMemo(() => dedicatedWishlist ?? [], [dedicatedWishlist]);
  const legacyItems = useMemo(() => legacyLibrary?.data ?? [], [legacyLibrary]);

  // Combined items count
  const totalCount = dedicatedItems.length + legacyItems.length;

  const filteredDedicated = useMemo(() => {
    return dedicatedItems.filter((item) => {
      if (storeFilter !== 'all' && item.store_preference !== storeFilter) return false;
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
      return true;
    });
  }, [dedicatedItems, storeFilter, priorityFilter]);

  const handleCheckDeals = async () => {
    try {
      const res = await refreshPricesMutation.mutateAsync();
      const count = res?.deals_meeting_target ?? 0;
      if (count > 0) {
        addToast({
          tone: 'success',
          title: 'Target Price Met!',
          message: `${count} game${count > 1 ? 's' : ''} on your wishlist met or beat your target purchase price!`,
        });
      } else {
        addToast({
          tone: 'neutral',
          title: 'Prices Refreshed',
          message: res?.has_api_key
            ? 'Checked live deals via IsThereAnyDeal and Steam Store (India).'
            : 'Checked live prices via Steam Store (India). For other stores, add an ITAD key in Settings.',
        });
      }
    } catch (err) {
      addToast({
        tone: 'error',
        title: 'Price Check Failed',
        message: err instanceof Error ? err.message : 'Could not refresh regional prices.',
      });
    }
  };

  const handleConvert = async () => {
    if (!convertTarget) return;
    try {
      await convertMutation.mutateAsync({
        id: convertTarget.id,
        payload: {
          ownership_status: 'Owned',
          playing_status: selectedStatus,
          platform: selectedPlatform,
        },
      });

      addToast({
        tone: 'success',
        title: 'Moved to Library',
        message: `"${convertTarget.game.title}" marked as purchased and added to your library.`,
      });
      setConvertTarget(null);
    } catch {
      addToast({
        tone: 'error',
        title: 'Conversion Failed',
        message: 'Could not move wishlist item to library.',
      });
    }
  };

  const handleDeleteDedicated = async (item: WishlistItemRead) => {
    try {
      await deleteWishlistMutation.mutateAsync(item.id);
      addToast({
        tone: 'neutral',
        title: 'Removed from Wishlist',
        message: `"${item.game.title}" removed.`,
      });
    } catch {
      addToast({ tone: 'error', title: 'Delete Failed', message: 'Could not remove item.' });
    }
  };

  const handleLegacyMarkOwned = async (entry: LibraryEntryRead) => {
    try {
      await updateLibraryMutation.mutateAsync({
        entryId: entry.id,
        updates: { ownership_status: 'Owned' },
      });
      addToast({
        tone: 'success',
        title: 'Marked as Owned',
        message: `"${entry.game.title}" is now Owned.`,
      });
    } catch {
      addToast({ tone: 'error', title: 'Update Failed', message: 'Could not update ownership.' });
    }
  };

  const handleLegacyRemove = async (entry: LibraryEntryRead) => {
    try {
      await removeLibraryMutation.mutateAsync(entry.id);
      addToast({
        tone: 'neutral',
        title: 'Removed from Wishlist',
        message: `"${entry.game.title}" removed.`,
      });
    } catch {
      addToast({ tone: 'error', title: 'Remove Failed', message: 'Could not remove entry.' });
    }
  };

  if (isWishLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-darker/60" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isWishError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to Load Wishlist"
          message="Could not load wishlist items."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-headline text-headline-xl font-bold text-on-background">Wishlist</h1>
            <Badge tone="accent" size="sm" className="tabular-nums">
              {totalCount}
            </Badge>
          </div>
          <p className="text-body-md text-on-surface-variant mt-1">
            Track future game purchases, store preferences, target discounts, and convert to active
            backlog when acquired.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            data-nav-item="true"
            variant="secondary"
            onClick={handleCheckDeals}
            disabled={refreshPricesMutation.isPending}
          >
            <RefreshCw
              className={`mr-1.5 h-4 w-4 ${refreshPricesMutation.isPending ? 'animate-spin' : ''}`}
            />
            {refreshPricesMutation.isPending ? 'Checking...' : 'Check Deals'}
          </Button>
          <Button
            data-nav-item="true"
            variant="primary"
            onClick={() => navigate(discoverRoute)}
          >
            <Compass className="mr-1.5 h-4 w-4" />
            Discover Games
          </Button>
        </div>
      </div>

      {/* Target Price Deals Notification Banner */}
      {pricesData && pricesData.deals_meeting_target > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-accent-gold/50 bg-accent-gold/10 p-4 text-on-background">
          <Sparkles className="h-5 w-5 shrink-0 text-accent-gold" />
          <div className="flex-1">
            <span className="font-semibold text-body-md text-accent-gold">
              {pricesData.deals_meeting_target} {pricesData.deals_meeting_target === 1 ? 'game' : 'games'} met your target purchase price!
            </span>
            <p className="text-caption text-on-surface-variant">
              Live deals verified for regional India (INR). Look for the "Target Met!" badge below.
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      {dedicatedItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-outline/65 bg-surface-darker/60 p-4">
          <div className="flex items-center gap-2 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
            <Filter className="h-4 w-4 text-accent-primary" />
            Filters:
          </div>

          <select
            data-nav-item="true"
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="rounded-xl border border-outline/70 bg-surface-dark px-3 py-1.5 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
          >
            <option value="all">All Stores</option>
            <option value="Steam">Steam</option>
            <option value="PlayStation Store">PlayStation Store</option>
            <option value="Epic Games">Epic Games</option>
            <option value="GOG">GOG</option>
            <option value="Nintendo eShop">Nintendo eShop</option>
            <option value="Xbox">Xbox</option>
          </select>

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
        </div>
      )}

      {/* Main Wishlist Content */}
      {totalCount === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-7 w-7" />}
          title="Your Wishlist is Empty"
          description="Browse the IGDB Catalog in Discover to bookmark games you want to purchase or play in the future."
          actionLabel="Browse Catalog"
          onAction={() => navigate(discoverRoute)}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {/* Phase 5 Dedicated Wishlist Items */}
          {filteredDedicated.map((item) => {
            const coverUrl =
              item.game.artworks?.find((a) => a.asset_type === 'cover')?.cached_url ??
              item.game.artworks?.find((a) => a.asset_type === 'cover')?.remote_url;

            const currencySymbol = item.currency === 'INR' ? '₹' : '$';

            return (
              <div
                key={item.id}
                data-nav-item="true"
                tabIndex={0}
                className="flex gap-4 rounded-2xl border border-outline/75 bg-secondary-background/85 p-4 shadow-card hover:border-accent-primary/60 transition-all focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                {/* Artwork */}
                <div className="w-28 sm:w-32 aspect-[2/3] shrink-0 overflow-hidden rounded-xl border border-outline/70 bg-surface-dark shadow-md">
                  {coverUrl ? (
                    <img src={coverUrl} alt={item.game.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-headline text-headline-sm font-bold text-on-background leading-snug line-clamp-1">
                        {item.game.title}
                      </h2>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <IconButton
                          label={`Edit ${item.game.title} target`}
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditTarget(item)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label={`Remove ${item.game.title}`}
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteDedicated(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
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

                      {item.store_preference && (
                        <Badge tone="neutral" size="sm">
                          {item.store_preference}
                        </Badge>
                      )}

                      {item.target_price && (
                        <span className="flex items-center gap-1 text-label-sm font-bold text-success font-mono">
                          <Tag className="h-3 w-3" />
                          Target: {currencySymbol}
                          {item.target_price}
                        </span>
                      )}
                    </div>

                    {(() => {
                      const price = priceMap.get(item.game_id);
                      if (!price || price.current_price === null || price.current_price === undefined) {
                        return (
                          <div className="mt-1.5 flex items-center gap-1.5 text-caption text-on-surface-variant">
                            <Tag className="h-3 w-3 text-muted" />
                            <span>Live price tracking: Click "Check Deals" above</span>
                          </div>
                        );
                      }
                      return (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-on-background font-mono">
                            Current: {currencySymbol}{price.current_price}
                          </span>
                          {price.discount_percent > 0 && (
                            <Badge tone="success" size="sm">
                              -{price.discount_percent}%
                            </Badge>
                          )}
                          {price.historical_low_price && (
                            <span className="text-caption text-on-surface-variant font-mono">
                              (Lowest: {currencySymbol}{price.historical_low_price})
                            </span>
                          )}
                          {price.is_deal_active && (
                            <Badge tone="accent" size="sm" className="font-semibold">
                              <Sparkles className="mr-1 h-3 w-3" />
                              Target Met!
                            </Badge>
                          )}
                          {price.store_deal_name && price.deal_url && (
                            <a
                              href={price.deal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-accent-primary hover:underline flex items-center gap-0.5"
                            >
                              {price.store_deal_name} <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      );
                    })()}

                    {item.notes && (
                      <p className="mt-1.5 text-caption text-on-surface-variant italic line-clamp-2">
                        "{item.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-outline/50">
                    <Button
                      data-nav-item="true"
                      size="sm"
                      variant="primary"
                      onClick={() => setConvertTarget(item)}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Mark Purchased
                    </Button>
                    <Button
                      data-nav-item="true"
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await convertMutation.mutateAsync({
                            id: item.id,
                            payload: {
                              ownership_status: 'Owned',
                              playing_status: 'Planned',
                              platform: item.store_preference || 'Steam',
                            },
                          });
                          addToast({
                            tone: 'success',
                            title: 'Moved to Backlog',
                            message: `"${item.game.title}" marked as Owned and queued in Backlog.`,
                          });
                        } catch {
                          addToast({ tone: 'error', title: 'Action Failed', message: 'Could not move to backlog.' });
                        }
                      }}
                    >
                      Move to Backlog
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Legacy To-Buy Library Entries */}
          {legacyItems.map((entry) => (
            <div
              key={entry.id}
              data-nav-item="true"
              tabIndex={0}
              className="flex gap-4 rounded-2xl border border-outline/75 bg-secondary-background/85 p-4 shadow-card hover:border-accent-primary/60 transition-colors"
            >
              <div
                className="w-24 shrink-0 overflow-hidden rounded-xl border border-outline/70 bg-surface-dark cursor-pointer"
                onClick={() => navigate(detailsRoute(entry.id))}
              >
                {entry.artwork?.cover_url ? (
                  <img src={entry.artwork.cover_url} alt={entry.game.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <h2
                      className="font-headline text-headline-sm font-bold text-on-background leading-snug line-clamp-1 cursor-pointer hover:text-accent-primary"
                      onClick={() => navigate(detailsRoute(entry.id))}
                    >
                      {entry.game.title}
                    </h2>
                    <IconButton
                      label={`Remove ${entry.game.title}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleLegacyRemove(entry)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="accent" size="sm">
                      {entry.platform}
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      {entry.priority}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-outline/50">
                  <Button
                    data-nav-item="true"
                    size="sm"
                    variant="primary"
                    onClick={() => void handleLegacyMarkOwned(entry)}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Mark Purchased
                  </Button>
                  <Button
                    data-nav-item="true"
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await updateLibraryMutation.mutateAsync({
                          entryId: entry.id,
                          updates: { ownership_status: 'Owned', playing_status: 'Planned' },
                        });
                        addToast({
                          tone: 'success',
                          title: 'Moved to Backlog',
                          message: `"${entry.game.title}" marked as Owned and queued in Backlog.`,
                        });
                      } catch {
                        addToast({ tone: 'error', title: 'Action Failed', message: 'Could not move to backlog.' });
                      }
                    }}
                  >
                    Move to Backlog
                  </Button>
                  <Button
                    data-nav-item="true"
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(detailsRoute(entry.id))}
                  >
                    Details
                  </Button>
                  <IconButton
                    label={`Remove ${entry.game.title} from Wishlist`}
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await removeLibraryMutation.mutateAsync(entry.id);
                        addToast({
                          tone: 'neutral',
                          title: 'Removed from Wishlist',
                          message: `"${entry.game.title}" removed.`,
                        });
                      } catch {
                        addToast({ tone: 'error', title: 'Action Failed', message: 'Could not remove item.' });
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Convert to Library Modal */}
      {convertTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-outline/80 bg-surface-darker p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-outline/70 pb-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-headline text-headline-sm font-bold text-on-background">
                  Move to Library
                </h3>
              </div>
              <button
                data-nav-item="true"
                onClick={() => setConvertTarget(null)}
                className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-body-sm text-on-surface-variant">
              Mark <strong className="text-on-background">{convertTarget.game.title}</strong> as
              purchased and promote it directly into your local library and backlog queue.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                  Platform Purchased On
                </label>
                <select
                  data-nav-item="true"
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
                >
                  <option value="PC">PC</option>
                  <option value="PlayStation 5">PlayStation 5</option>
                  <option value="PlayStation 4">PlayStation 4</option>
                  <option value="Xbox Series X/S">Xbox Series X/S</option>
                  <option value="Nintendo Switch">Nintendo Switch</option>
                  <option value="Steam Deck">Steam Deck</option>
                </select>
              </div>

              <div>
                <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                  Initial Playing Status
                </label>
                <select
                  data-nav-item="true"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
                >
                  <option value="Planned">Planned (Backlog Queue)</option>
                  <option value="Currently Playing">Currently Playing (Play Now)</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/60">
                <Button data-nav-item="true" variant="ghost" onClick={() => setConvertTarget(null)}>
                  Cancel
                </Button>
                <Button
                  data-nav-item="true"
                  variant="primary"
                  onClick={handleConvert}
                  disabled={convertMutation.isPending}
                >
                  {convertMutation.isPending ? 'Moving...' : 'Add to Library'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Wishlist Item Modal */}
      <EditWishlistModal
        open={Boolean(editTarget)}
        item={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </div>
  );
}
