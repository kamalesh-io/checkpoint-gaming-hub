import { useMemo, useState } from 'react';
import { Check, Image as ImageIcon, RotateCcw, Sparkles } from 'lucide-react';
import { GameArtwork } from '@/components/game/GameArtwork';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import {
  useSelectArtworkMutation,
  useSteamGridDbArtworkQuery,
} from '@/hooks/queries';
import { CheckpointApiError } from '@/services/api';
import { useToastStore } from '@/stores/toastStore';
import { soundManager } from '@/audio/soundManager';
import type { LibraryEntryRead, SteamGridDBItem } from '@/types';
import { cn } from '@/utils/cn';

type ArtworkTab = 'cover' | 'hero' | 'logo';

export interface ArtworkSelectorModalProps {
  entry: LibraryEntryRead | null;
  isOpen: boolean;
  initialTab?: ArtworkTab;
  onClose: () => void;
}

const INITIAL_VISIBLE_COUNT = 12;

function ArtworkSelectorBody({
  entry,
  initialTab,
  onClose,
}: {
  entry: LibraryEntryRead;
  initialTab: ArtworkTab;
  onClose: () => void;
}) {
  const addToast = useToastStore((s) => s.addToast);
  const selectMutation = useSelectArtworkMutation();

  const [activeTab, setActiveTab] = useState<ArtworkTab>(initialTab);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [selectedItem, setSelectedItem] = useState<SteamGridDBItem | null>(null);

  const artworkQuery = useSteamGridDbArtworkQuery(entry.game.igdb_id, true);

  const itemsForTab: SteamGridDBItem[] = useMemo(() => {
    const data = artworkQuery.data;
    if (!data) return [];
    if (activeTab === 'cover') return data.grids;
    if (activeTab === 'hero') return data.heroes;
    return data.logos;
  }, [artworkQuery.data, activeTab]);

  const tabItems: TabItem<ArtworkTab>[] = [
    {
      id: 'cover',
      label: 'Portrait Covers',
      badge: artworkQuery.data?.grids.length,
    },
    {
      id: 'hero',
      label: 'Landscape Heroes',
      badge: artworkQuery.data?.heroes.length,
    },
    {
      id: 'logo',
      label: 'Transparent Logos',
      badge: artworkQuery.data?.logos.length,
    },
  ];

  const activeAssetForTab = entry.game.artworks.find(
    (a) => a.asset_type === activeTab && a.is_active,
  );
  const currentActiveRemoteUrl = activeAssetForTab?.remote_url ?? null;

  const defaultCandidate =
    entry.game.artworks.find(
      (a) => a.asset_type === activeTab && a.source === 'igdb',
    ) ?? entry.game.artworks.find((a) => a.asset_type === activeTab);

  const handleTabChange = (nextTab: ArtworkTab) => {
    soundManager.playClick();
    setActiveTab(nextTab);
    setSelectedItem(null);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  const handleApply = async () => {
    if (!selectedItem) return;

    const matchingLocal = entry.game.artworks.find(
      (a) => a.asset_type === activeTab && a.remote_url === selectedItem.url,
    );

    try {
      await selectMutation.mutateAsync({
        asset_id: matchingLocal?.id,
        game_id: entry.game_id,
        asset_type: activeTab,
        steamgriddb_url: selectedItem.url,
        width: selectedItem.width,
        height: selectedItem.height,
        author: selectedItem.author,
      });
      soundManager.playDone();
      addToast({
        type: 'success',
        title: 'Artwork updated',
        description: `Applied new ${activeTab} artwork for ${entry.game.title}.`,
      });
      setSelectedItem(null);
      onClose();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Artwork update failed',
        description:
          err instanceof CheckpointApiError
            ? err.message
            : 'Unable to cache or activate selected artwork.',
      });
    }
  };

  const handleRestoreDefault = async () => {
    if (!defaultCandidate) return;
    try {
      await selectMutation.mutateAsync({
        asset_id: defaultCandidate.id,
        game_id: entry.game_id,
        asset_type: activeTab,
        steamgriddb_url: defaultCandidate.remote_url,
      });
      soundManager.playDone();
      addToast({
        type: 'info',
        title: 'Default artwork restored',
        description: `Restored ${activeTab} artwork for ${entry.game.title}.`,
      });
      setSelectedItem(null);
      onClose();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Restore failed',
        description:
          err instanceof CheckpointApiError ? err.message : 'Unable to restore default artwork.',
      });
    }
  };

  const visibleItems = itemsForTab.slice(0, visibleCount);
  const hasMore = visibleCount < itemsForTab.length;

  return (
    <div className="space-y-5">
      <Tabs
        items={tabItems}
        activeId={activeTab}
        onChange={handleTabChange}
        variant="pill"
        ariaLabel="Artwork Categories"
      />

      {artworkQuery.isLoading ? (
        <div
          className={cn(
            'grid gap-4',
            activeTab === 'cover' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2',
          )}
        >
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton
              key={idx}
              className={cn(
                'w-full rounded-xl',
                activeTab === 'cover' ? 'aspect-[2/3]' : 'aspect-[16/9]',
              )}
            />
          ))}
        </div>
      ) : artworkQuery.isError ? (
        <ErrorState
          title="Unable to fetch SteamGridDB artwork"
          message={
            artworkQuery.error instanceof CheckpointApiError
              ? artworkQuery.error.message
              : 'External artwork provider may be offline or unavailable.'
          }
          onRetry={() => void artworkQuery.refetch()}
        />
      ) : itemsForTab.length === 0 ? (
        <EmptyState
          compact
          icon={<ImageIcon className="h-6 w-6" />}
          title={`No ${activeTab} artwork options found`}
          description="SteamGridDB returned zero entries for this asset category. Your current artwork stays preserved."
        />
      ) : (
        <div className="space-y-5">
          <div
            className={cn(
              'grid gap-4',
              activeTab === 'cover'
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-2',
            )}
          >
            {visibleItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const isCurrentActive = currentActiveRemoteUrl === item.url;
              const isCached = entry.game.artworks.some(
                (a) => a.asset_type === activeTab && a.remote_url === item.url,
              );

              return (
                <button
                  key={item.id}
                  type="button"
                  data-nav-item="true"
                  onClick={() => {
                    soundManager.playSelect();
                    setSelectedItem(item);
                  }}
                  className={cn(
                    'group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-150',
                    isSelected
                      ? 'border-accent-active checkpoint-accent-glow bg-surface-elevated'
                      : isCurrentActive
                        ? 'border-success/65 bg-surface/80'
                        : 'border-outline/75 bg-surface/60 hover:border-outline hover:-translate-y-0.5',
                  )}
                >
                  <div
                    className={cn(
                      'relative w-full overflow-hidden',
                      activeTab === 'cover'
                        ? 'aspect-[2/3]'
                        : activeTab === 'hero'
                          ? 'aspect-[16/9]'
                          : 'aspect-[16/9] bg-[#0C0F12] p-4 flex items-center justify-center',
                    )}
                  >
                    {activeTab === 'logo' ? (
                      <img
                        src={item.thumb || item.url}
                        alt={`${entry.game.title} logo option`}
                        loading="lazy"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <GameArtwork
                        src={item.thumb || item.url}
                        alt={`${entry.game.title} ${activeTab}`}
                        aspect={activeTab === 'cover' ? 'portrait' : 'landscape'}
                        className="h-full w-full"
                      />
                    )}

                    {/* Status Badges */}
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                      {isCurrentActive && (
                        <Badge tone="success" size="sm">
                          Active
                        </Badge>
                      )}
                      {isCached && !isCurrentActive && (
                        <Badge tone="neutral" size="sm">
                          Cached
                        </Badge>
                      )}
                    </div>

                    {isSelected && (
                      <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent-active text-on-accent-active shadow-card">
                        <Check className="h-4 w-4 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] text-muted border-t border-outline/55 bg-secondary-background/80 w-full">
                    <span className="truncate">
                      {item.author ? `by ${item.author}` : 'SteamGridDB'}
                    </span>
                    <span className="tabular-nums shrink-0 text-on-surface/80">
                      {item.width}×{item.height}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  soundManager.playNextPage();
                  setVisibleCount((c) => c + INITIAL_VISIBLE_COUNT);
                }}
              >
                Load More ({itemsForTab.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-outline/75 pt-4">
        <div>
          {defaultCandidate && defaultCandidate.id !== activeAssetForTab?.id && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              isLoading={selectMutation.isPending}
              onClick={() => void handleRestoreDefault()}
            >
              Restore Default {activeTab}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!selectedItem}
            isLoading={selectMutation.isPending}
            leftIcon={<Sparkles className="h-4 w-4" />}
            onClick={() => void handleApply()}
          >
            Apply Artwork
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ArtworkSelectorModal({
  entry,
  isOpen,
  initialTab = 'cover',
  onClose,
}: ArtworkSelectorModalProps) {
  if (!entry || !isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="SteamGridDB Artwork Selector"
      subtitle={`Customize covers, heroes & transparent logos for ${entry.game.title}`}
      size="xl"
    >
      <ArtworkSelectorBody
        key={`${entry.id}-${initialTab}`}
        entry={entry}
        initialTab={initialTab}
        onClose={onClose}
      />
    </Modal>
  );
}
