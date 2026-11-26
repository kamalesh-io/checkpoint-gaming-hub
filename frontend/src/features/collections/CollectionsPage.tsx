import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  FolderKanban,
  Gamepad2,
  Layers,
  Pin,
  Plus,
  Trash2,
  X,
  Edit2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CreateCollectionModal } from '@/features/collections/CreateCollectionModal';
import { FranchiseOrderModal } from '@/features/collections/FranchiseOrderModal';
import {
  useAddCollectionItemMutation,
  useCollectionDetailQuery,
  useCollectionsQuery,
  useDeleteCollectionMutation,
  useFranchisesQuery,
  useLibraryQuery,
  useRemoveCollectionItemMutation,
  useReorderCollectionItemsMutation,
} from '@/hooks/queries';
import { buildGameDetailsRoute } from '@/routes/routes';
import { useToastStore } from '@/stores/toastStore';
import type { CollectionRead, FranchiseDetailRead } from '@/types';
import { formatHoursLogged } from '@/utils/format';

export function CollectionsPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<'collections' | 'franchises'>('collections');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionRead | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [franchiseOrderTarget, setFranchiseOrderTarget] = useState<FranchiseDetailRead | null>(null);
  const [isAddGameOpen, setIsAddGameOpen] = useState(false);

  const { data: collections, isLoading: isColsLoading, isError: isColsError } = useCollectionsQuery();
  const { data: franchises, isLoading: isFranLoading } = useFranchisesQuery();
  const { data: selectedCollectionDetail } = useCollectionDetailQuery(selectedCollectionId ?? '');
  const { data: libraryData } = useLibraryQuery({ limit: 100 });

  const deleteCollectionMutation = useDeleteCollectionMutation();
  const addItemMutation = useAddCollectionItemMutation();
  const removeItemMutation = useRemoveCollectionItemMutation();
  const reorderMutation = useReorderCollectionItemsMutation();

  const handleDeleteCollection = async (col: CollectionRead) => {
    if (!window.confirm(`Delete collection "${col.name}"? Note: Games in this collection will NOT be deleted from your library.`)) {
      return;
    }
    try {
      await deleteCollectionMutation.mutateAsync(col.id);
      if (selectedCollectionId === col.id) setSelectedCollectionId(null);
      addToast({
        tone: 'neutral',
        title: 'Collection Deleted',
        message: `Removed "${col.name}". All games remain safely in your library.`,
      });
    } catch {
      addToast({ tone: 'error', title: 'Delete Failed', message: 'Could not remove collection.' });
    }
  };

  const handleRemoveGameFromCollection = async (libraryEntryId: string) => {
    if (!selectedCollectionId) return;
    try {
      await removeItemMutation.mutateAsync({
        collectionId: selectedCollectionId,
        libraryEntryId,
      });
      addToast({ tone: 'neutral', title: 'Item Removed', message: 'Game removed from collection.' });
    } catch {
      addToast({ tone: 'error', title: 'Remove Failed', message: 'Could not remove game.' });
    }
  };

  const handleMoveCollectionItem = async (index: number, direction: 'up' | 'down') => {
    if (!selectedCollectionDetail || !selectedCollectionId) return;
    const items = [...selectedCollectionDetail.items];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const moved = items[index];
    if (!moved) return;
    items.splice(index, 1);
    items.splice(targetIdx, 0, moved);

    try {
      await reorderMutation.mutateAsync({
        collectionId: selectedCollectionId,
        entryIds: items.map((i) => i.library_entry_id),
      });
    } catch {
      addToast({ tone: 'error', title: 'Reorder Failed', message: 'Could not reorder collection.' });
    }
  };

  const handleAddGame = async (entryId: string) => {
    if (!selectedCollectionId) return;
    try {
      await addItemMutation.mutateAsync({
        collectionId: selectedCollectionId,
        payload: { library_entry_id: entryId },
      });
      setIsAddGameOpen(false);
      addToast({ tone: 'success', title: 'Game Added', message: 'Added to collection.' });
    } catch {
      addToast({ tone: 'error', title: 'Add Failed', message: 'Could not add game to collection.' });
    }
  };

  if (isColsLoading || isFranLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-darker/60" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isColsError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to Load Collections"
          message="Could not retrieve collections from database."
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
              Collections & Franchises
            </h1>
            <Badge tone="accent" size="sm">
              {activeTab === 'collections'
                ? `${collections?.length ?? 0} Collections`
                : `${franchises?.length ?? 0} Franchises`}
            </Badge>
          </div>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Create thematic game playlists, custom series orders, and curated gaming binders.
          </p>
        </div>

        {/* Tab switcher & New Collection button */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-outline/70 bg-surface-darker/70 p-1">
            <button
              data-nav-item="true"
              onClick={() => setActiveTab('collections')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
                activeTab === 'collections'
                  ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-background'
              }`}
            >
              <FolderKanban className="h-4 w-4" />
              Collections
            </button>
            <button
              data-nav-item="true"
              onClick={() => setActiveTab('franchises')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
                activeTab === 'franchises'
                  ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-background'
              }`}
            >
              <Layers className="h-4 w-4" />
              Franchises
            </button>
          </div>

          {activeTab === 'collections' && (
            <Button
              data-nav-item="true"
              variant="primary"
              onClick={() => {
                setEditingCollection(null);
                setIsCreateModalOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Collection
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'collections' ? (
        /* ==================== COLLECTIONS TAB ==================== */
        <div>
          {!collections || collections.length === 0 ? (
            <EmptyState
              title="No Collections Yet"
              message="Organize your library into custom playlists, themes, or challenge runs."
              actionLabel="Create Your First Collection"
              onAction={() => setIsCreateModalOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((col) => {
                const completionPct =
                  col.game_count > 0 ? Math.round((col.completed_count / col.game_count) * 100) : 0;

                return (
                  <div
                    key={col.id}
                    data-nav-item="true"
                    tabIndex={0}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-outline/70 bg-secondary-background/85 transition-all duration-200 hover:border-accent-primary/60 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  >
                    {/* Banner / Header */}
                    <div className="relative h-32 w-full bg-surface-dark overflow-hidden">
                      {col.banner_url ? (
                        <img
                          src={col.banner_url}
                          alt={col.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-dark via-surface-darker to-secondary-background text-on-surface-variant/40">
                          <FolderKanban className="h-12 w-12" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-secondary-background via-secondary-background/40 to-transparent" />

                      {col.is_pinned && (
                        <div className="absolute top-3 right-3 rounded-lg bg-accent-primary/90 p-1.5 text-black shadow-sm">
                          <Pin className="h-3.5 w-3.5 fill-current" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-headline text-headline-sm font-bold text-on-background group-hover:text-accent-primary transition-colors">
                          {col.name}
                        </h3>
                        {col.description && (
                          <p className="mt-1 text-body-sm text-on-surface-variant line-clamp-2">
                            {col.description}
                          </p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="mt-4 flex items-center justify-between border-t border-outline/50 pt-3 text-caption text-on-surface-variant">
                        <span>
                          {col.game_count} {col.game_count === 1 ? 'game' : 'games'}
                        </span>
                        <span>{formatHoursLogged(col.total_hours)}</span>
                        <Badge tone={completionPct === 100 ? 'success' : 'neutral'} size="sm">
                          {completionPct}% Complete
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex items-center justify-between pt-2">
                        <Button
                          data-nav-item="true"
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedCollectionId(col.id)}
                        >
                          View Games
                        </Button>

                        <div className="flex items-center gap-1">
                          <button
                            data-nav-item="true"
                            onClick={() => {
                              setEditingCollection(col);
                              setIsCreateModalOpen(true);
                            }}
                            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            data-nav-item="true"
                            onClick={() => handleDeleteCollection(col)}
                            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-error"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ==================== FRANCHISES TAB ==================== */
        <div className="space-y-4">
          {!franchises || franchises.length === 0 ? (
            <EmptyState
              title="No Franchises Detected"
              message="Add games with franchise links from IGDB (e.g. The Witcher, Dark Souls, Final Fantasy) to browse series groupings."
            />
          ) : (
            franchises.map((f) => (
              <div
                key={f.id}
                className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-outline/60 pb-3">
                  <div>
                    <h3 className="font-headline text-headline-md font-bold text-on-background">
                      {f.name}
                    </h3>
                    <p className="mt-0.5 text-body-sm text-on-surface-variant">
                      {f.games.length} games in series • {f.owned_games ?? f.library_count ?? 0} in your library
                    </p>
                  </div>

                  <Button
                    data-nav-item="true"
                    variant="secondary"
                    size="sm"
                    onClick={() => setFranchiseOrderTarget(f)}
                  >
                    <Layers className="mr-1.5 h-4 w-4 text-accent-primary" />
                    Set Custom Play Order
                  </Button>
                </div>

                {/* Franchise constituent games grid */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {f.games.map((g, idx) => (
                    <div
                      key={g.game_id}
                      className="flex items-center gap-3 rounded-xl border border-outline/60 bg-surface-dark/70 p-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-darker font-bold text-accent-primary tabular-nums">
                        #{g.franchise_order ?? idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-headline text-body-sm font-semibold text-on-background truncate">
                          {g.title}
                        </p>
                        {g.release_date && (
                          <p className="text-caption text-on-surface-variant">
                            {new Date(g.release_date).getFullYear()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Collection Details Drawer / Modal */}
      {selectedCollectionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-2xl rounded-2xl border border-outline/80 bg-surface-darker p-6 shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-outline/70 pb-3">
              <div>
                <h3 className="font-headline text-headline-md font-bold text-on-background">
                  {selectedCollectionDetail.name}
                </h3>
                {selectedCollectionDetail.description && (
                  <p className="text-body-sm text-on-surface-variant">
                    {selectedCollectionDetail.description}
                  </p>
                )}
              </div>
              <button
                data-nav-item="true"
                onClick={() => setSelectedCollectionId(null)}
                className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="my-3 flex items-center justify-between">
              <span className="text-body-sm text-on-surface-variant">
                {selectedCollectionDetail.items.length} items in custom order
              </span>

              <Button
                data-nav-item="true"
                variant="primary"
                size="sm"
                onClick={() => setIsAddGameOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Game to Collection
              </Button>
            </div>

            {/* Games List with Reordering */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {selectedCollectionDetail.items.length === 0 ? (
                <div className="py-12 text-center text-body-md text-on-surface-variant">
                  No games in this collection yet. Click "Add Game to Collection" above.
                </div>
              ) : (
                selectedCollectionDetail.items.map((item, index) => {
                  const entry = item.library_entry;
                  const coverUrl = entry.game.artworks?.find((a) => a.artwork_type === 'cover')?.url;

                  return (
                    <div
                      key={item.library_entry_id}
                      className="flex items-center justify-between rounded-xl border border-outline/70 bg-surface-dark p-3"
                    >
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => navigate(buildGameDetailsRoute(entry.id))}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-darker font-bold text-accent-primary tabular-nums">
                          #{index + 1}
                        </span>

                        <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-surface-darker">
                          {coverUrl ? (
                            <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
                          ) : (
                            <Gamepad2 className="h-4 w-4 text-on-surface-variant m-auto mt-4" />
                          )}
                        </div>

                        <div>
                          <p className="font-headline text-body-md font-bold text-on-background hover:text-accent-primary">
                            {entry.game.title}
                          </p>
                          <div className="flex items-center gap-2 text-caption text-on-surface-variant">
                            <Badge tone="neutral" size="sm">
                              {entry.playing_status}
                            </Badge>
                            <span>{formatHoursLogged(entry.playtime_hours)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          data-nav-item="true"
                          disabled={index === 0}
                          onClick={() => handleMoveCollectionItem(index, 'up')}
                          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background disabled:opacity-20"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          data-nav-item="true"
                          disabled={index === selectedCollectionDetail.items.length - 1}
                          onClick={() => handleMoveCollectionItem(index, 'down')}
                          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background disabled:opacity-20"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          data-nav-item="true"
                          onClick={() => handleRemoveGameFromCollection(item.library_entry_id)}
                          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-outline/60 flex justify-end">
              <Button data-nav-item="true" variant="ghost" onClick={() => setSelectedCollectionId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Game to Collection Picker Modal */}
      {isAddGameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-outline/80 bg-surface-darker p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-outline/70 pb-3">
              <h3 className="font-headline text-headline-sm font-bold text-on-background">
                Add Game to Collection
              </h3>
              <button
                data-nav-item="true"
                onClick={() => setIsAddGameOpen(false)}
                className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 max-h-[350px] overflow-y-auto space-y-2">
              {(libraryData?.data ?? []).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl border border-outline/60 bg-surface-dark p-2.5 hover:border-accent-primary"
                >
                  <p className="font-headline text-body-sm font-semibold text-on-background truncate max-w-[240px]">
                    {entry.game.title}
                  </p>
                  <Button
                    data-nav-item="true"
                    variant="primary"
                    size="sm"
                    onClick={() => handleAddGame(entry.id)}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <CreateCollectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        collectionToEdit={editingCollection}
      />

      {/* Franchise Order Modal */}
      <FranchiseOrderModal
        key={franchiseOrderTarget?.id ?? 'none'}
        franchise={franchiseOrderTarget}
        isOpen={Boolean(franchiseOrderTarget)}
        onClose={() => setFranchiseOrderTarget(null)}
      />
    </div>
  );
}
