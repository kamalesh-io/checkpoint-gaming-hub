import { useState } from 'react';
import { ArrowDown, ArrowUp, Layers, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useUpdateFranchiseOrderMutation } from '@/hooks/queries';
import { useToastStore } from '@/stores/toastStore';
import type { FranchiseDetailRead } from '@/types';

interface FranchiseOrderModalProps {
  franchise: FranchiseDetailRead | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FranchiseOrderModal({
  franchise,
  isOpen,
  onClose,
}: FranchiseOrderModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const updateOrderMutation = useUpdateFranchiseOrderMutation();

  const [orderedGames, setOrderedGames] = useState<FranchiseDetailRead['games']>(() =>
    franchise ? [...franchise.games] : [],
  );

  if (!isOpen || !franchise) return null;

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedGames.length) return;

    const updated = [...orderedGames];
    const moved = updated[index];
    if (!moved) return;
    updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setOrderedGames(updated);
  };

  const handleSave = async () => {
    try {
      const items = orderedGames.map((g, idx) => ({
        game_id: g.game_id,
        order: idx + 1,
      }));

      await updateOrderMutation.mutateAsync({
        franchiseId: franchise.id,
        items,
      });

      addToast({
        tone: 'success',
        title: 'Play Order Saved',
        message: `Updated custom franchise playing order for "${franchise.name}".`,
      });
      onClose();
    } catch {
      addToast({
        tone: 'error',
        title: 'Save Failed',
        message: 'Could not update franchise order.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-outline/80 bg-surface-darker p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-outline/70 pb-3">
          <div className="flex items-center gap-2 text-accent-primary">
            <Layers className="h-5 w-5" />
            <h3 className="font-headline text-headline-sm font-bold text-on-background">
              Franchise Playing Order: {franchise.name}
            </h3>
          </div>
          <button
            data-nav-item="true"
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-body-sm text-on-surface-variant">
          Arrange games in your preferred chronological or narrative playing sequence.
        </p>

        <div className="mt-4 space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {orderedGames.map((game, index) => (
            <div
              key={game.game_id}
              className="flex items-center justify-between rounded-xl border border-outline/70 bg-surface-dark p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-darker text-label-sm font-bold text-accent-primary tabular-nums">
                  #{index + 1}
                </span>
                <div>
                  <p className="font-headline text-body-md font-semibold text-on-background">
                    {game.title}
                  </p>
                  {game.release_date && (
                    <p className="text-caption text-on-surface-variant">
                      Released: {new Date(game.release_date).getFullYear()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  data-nav-item="true"
                  disabled={index === 0}
                  onClick={() => handleMove(index, 'up')}
                  className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background disabled:opacity-20"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  data-nav-item="true"
                  disabled={index === orderedGames.length - 1}
                  onClick={() => handleMove(index, 'down')}
                  className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background disabled:opacity-20"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-outline/60">
          <Button data-nav-item="true" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-nav-item="true"
            variant="primary"
            onClick={handleSave}
            disabled={updateOrderMutation.isPending}
          >
            {updateOrderMutation.isPending ? 'Saving...' : 'Save Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
