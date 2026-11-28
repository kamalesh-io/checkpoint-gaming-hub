import { useState } from 'react';
import {
  CheckSquare,
  Clock,
  DownloadCloud,
  RefreshCw,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useSteamImportMutation,
  useSteamImportPreviewQuery,
} from '@/hooks/queries/usePhase6Queries';
import { useToastStore } from '@/stores/toastStore';
import { soundManager } from '@/audio/soundManager';
import type { SteamGamePreview } from '@/types';
import { cn } from '@/utils/cn';
import { formatHoursLogged } from '@/utils/format';

interface SteamImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function SteamImportModal({ open, onClose }: SteamImportModalProps) {
  const { data, isLoading, isError, error, refetch } = useSteamImportPreviewQuery(open);
  const importMutation = useSteamImportMutation();
  const addToast = useToastStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<'new' | 'existing' | 'unmatched'>('new');
  const [userSelected, setUserSelected] = useState<Set<number> | null>(null);
  const [ownershipOverrides, setOwnershipOverrides] = useState<Record<number, string>>({});

  // Default selection is all new games
  const defaultSelected = new Set(data?.new_games?.map((g) => g.steam_app_id) || []);
  const selectedAppIds = userSelected ?? defaultSelected;

  const toggleAppId = (appId: number) => {
    const next = new Set(selectedAppIds);
    if (next.has(appId)) {
      next.delete(appId);
    } else {
      next.add(appId);
    }
    setUserSelected(next);
  };

  const selectAllInActiveTab = () => {
    const currentList =
      activeTab === 'new'
        ? data?.new_games
        : activeTab === 'existing'
          ? data?.existing_games
          : data?.unmatched_games;
    if (!currentList) return;
    const next = new Set(selectedAppIds);
    currentList.forEach((g) => next.add(g.steam_app_id));
    setUserSelected(next);
  };

  const deselectAllInActiveTab = () => {
    const currentList =
      activeTab === 'new'
        ? data?.new_games
        : activeTab === 'existing'
          ? data?.existing_games
          : data?.unmatched_games;
    if (!currentList) return;
    const next = new Set(selectedAppIds);
    currentList.forEach((g) => next.delete(g.steam_app_id));
    setUserSelected(next);
  };

  const handleOwnershipChange = (appId: number, status: string) => {
    setOwnershipOverrides((prev) => ({
      ...prev,
      [appId]: status,
    }));
  };

  const handleImport = async () => {
    const ids = Array.from(selectedAppIds);
    if (ids.length === 0) return;

    try {
      const res = await importMutation.mutateAsync({
        app_ids: ids,
        ownership_status_overrides: ownershipOverrides,
      });
      soundManager.playDone();
      addToast({
        title: 'Steam Library Synchronized',
        description: res.message,
        tone: 'success',
      });
      onClose();
    } catch (err) {
      addToast({
        title: 'Import Failed',
        description: err instanceof Error ? err.message : 'Synchronization failed.',
        tone: 'error',
      });
    }
  };

  const activeList: SteamGamePreview[] =
    activeTab === 'new'
      ? data?.new_games || []
      : activeTab === 'existing'
        ? data?.existing_games || []
        : data?.unmatched_games || [];

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Steam Library Synchronization"
      subtitle="Scan and import Steam titles with automatic playtime attribution and family share tagging."
      size="lg"
    >
      <div className="space-y-5 pt-2">
        {isLoading ? (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center gap-3 text-accent-primary">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="font-semibold text-body-md">
                Scanning Steam account games & metadata...
              </span>
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : isError || !data ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-5 text-center space-y-3">
            <p className="text-body-md font-semibold text-danger">
              Failed to scan Steam library
            </p>
            <p className="text-body-sm text-muted">
              {error instanceof Error ? error.message : 'Please check your Steam Web API Key and profile privacy.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => refetch()}
              data-nav-item="true"
            >
              Retry Scan
            </Button>
          </div>
        ) : (
          <>
            {/* Header Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline/50 pb-3">
              <div className="flex items-center gap-2">
                <Button
                  variant={activeTab === 'new' ? 'accent' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveTab('new')}
                  data-nav-item="true"
                >
                  New to Library ({data.new_games.length})
                </Button>
                <Button
                  variant={activeTab === 'existing' ? 'accent' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveTab('existing')}
                  data-nav-item="true"
                >
                  Already in Library ({data.existing_games.length})
                </Button>
                <Button
                  variant={activeTab === 'unmatched' ? 'accent' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveTab('unmatched')}
                  data-nav-item="true"
                >
                  Unmatched ({data.unmatched_games.length})
                </Button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<CheckSquare className="h-3.5 w-3.5" />}
                  onClick={selectAllInActiveTab}
                  data-nav-item="true"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Square className="h-3.5 w-3.5" />}
                  onClick={deselectAllInActiveTab}
                  data-nav-item="true"
                >
                  Deselect
                </Button>
              </div>
            </div>

            {/* Games List Container */}
            <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
              {activeList.length === 0 ? (
                <div className="rounded-xl border border-outline/40 bg-surface-darker/40 p-8 text-center text-muted">
                  No games found in this category.
                </div>
              ) : (
                activeList.map((game) => {
                  const isSelected = selectedAppIds.has(game.steam_app_id);
                  const ownership =
                    ownershipOverrides[game.steam_app_id] || game.ownership_status;

                  return (
                    <div
                      key={game.steam_app_id}
                      onClick={() => toggleAppId(game.steam_app_id)}
                      className={cn(
                        'flex items-center justify-between gap-4 rounded-xl border p-3 transition-all cursor-pointer',
                        isSelected
                          ? 'border-accent-primary/80 bg-surface-darker shadow-sm'
                          : 'border-outline/50 bg-secondary-background/60 opacity-70 hover:opacity-100',
                      )}
                      data-nav-item="true"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // Handled by row click
                          className="h-4 w-4 rounded accent-accent-primary cursor-pointer shrink-0"
                        />
                        {game.cover_url ? (
                          <img
                            src={game.cover_url}
                            alt={game.title}
                            className="h-12 w-9 rounded object-cover shrink-0 bg-surface-dark border border-outline/40"
                          />
                        ) : (
                          <div className="h-12 w-9 rounded flex items-center justify-center bg-surface-dark border border-outline/40 text-muted shrink-0 text-xs">
                            Steam
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-body-sm text-on-background truncate">
                            {game.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatHoursLogged(game.playtime_forever_minutes / 60.0)} on Steam
                            </span>
                            <span>•</span>
                            <span>App #{game.steam_app_id}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Ownership Status Selector */}
                      <div
                        className="flex items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={ownership}
                          onChange={(e) =>
                            handleOwnershipChange(game.steam_app_id, e.target.value)
                          }
                          className="rounded-lg border border-outline/70 bg-surface-darker px-2.5 py-1 text-xs text-on-background focus:border-accent-primary focus:outline-none"
                          data-nav-item="true"
                        >
                          <option value="Owned">Owned</option>
                          <option value="Family Shared">Family Shared</option>
                          <option value="Subscription">Subscription</option>
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-outline/50 pt-4">
              <span className="text-body-sm text-muted">
                {selectedAppIds.size} titles selected for synchronization
              </span>

              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={onClose} data-nav-item="true">
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  leftIcon={
                    <DownloadCloud
                      className={cn('h-4 w-4', importMutation.isPending && 'animate-spin')}
                    />
                  }
                  onClick={handleImport}
                  disabled={selectedAppIds.size === 0 || importMutation.isPending}
                  data-nav-item="true"
                >
                  {importMutation.isPending
                    ? 'Importing...'
                    : `Sync Selected (${selectedAppIds.size})`}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
