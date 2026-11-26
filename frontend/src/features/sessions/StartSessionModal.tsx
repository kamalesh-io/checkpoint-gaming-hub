import { useState, type FormEvent } from 'react';
import { Play, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLibraryQuery, useStartActiveSessionMutation } from '@/hooks/queries';
import { useToastStore } from '@/stores/toastStore';

interface StartSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedEntryId?: string;
}

export function StartSessionModal({
  isOpen,
  onClose,
  preselectedEntryId,
}: StartSessionModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const { data: libraryData } = useLibraryQuery({ limit: 100 });
  const startMutation = useStartActiveSessionMutation();

  const [entryId, setEntryId] = useState<string>(preselectedEntryId ?? '');
  const [chapter, setChapter] = useState<string>('');

  if (!isOpen) return null;

  const libraryEntries = libraryData?.data ?? [];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!entryId) {
      addToast({ tone: 'error', title: 'Game Required', message: 'Please select a game.' });
      return;
    }

    try {
      await startMutation.mutateAsync({
        library_entry_id: entryId,
        location_or_chapter: chapter.trim() || null,
      });

      addToast({
        tone: 'accent',
        title: 'Session Started',
        message: 'Live play timer is now running.',
      });
      onClose();
    } catch {
      addToast({
        tone: 'error',
        title: 'Start Failed',
        message: 'Could not start play session.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-outline/80 bg-surface-darker p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-outline/70 pb-3">
          <div className="flex items-center gap-2 text-accent-primary">
            <Play className="h-5 w-5 fill-current" />
            <h3 className="font-headline text-headline-sm font-bold text-on-background">
              Start Play Session
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Select Game
            </label>
            <select
              data-nav-item="true"
              value={entryId}
              onChange={(e) => setEntryId(e.target.value)}
              required
              className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
            >
              <option value="">-- Choose game from library --</option>
              {libraryEntries.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.game.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Current Chapter / Objective (optional)
            </label>
            <input
              data-nav-item="true"
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Chapter 3, Dungeon boss"
              className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/60">
            <Button data-nav-item="true" variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              data-nav-item="true"
              variant="primary"
              type="submit"
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? 'Starting...' : 'Start Timer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
