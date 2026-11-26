import { useState, type FormEvent } from 'react';
import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLibraryQuery, useLogManualSessionMutation } from '@/hooks/queries';
import { useToastStore } from '@/stores/toastStore';

interface ManualSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedEntryId?: string;
}

export function ManualSessionModal({
  isOpen,
  onClose,
  preselectedEntryId,
}: ManualSessionModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const { data: libraryData } = useLibraryQuery({ limit: 100 });
  const logMutation = useLogManualSessionMutation();

  const [entryId, setEntryId] = useState<string>(preselectedEntryId ?? '');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [sessionDate, setSessionDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [chapter, setChapter] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const libraryEntries = libraryData?.data ?? [];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!entryId) {
      addToast({ tone: 'error', title: 'Game Required', message: 'Please select a game.' });
      return;
    }

    try {
      await logMutation.mutateAsync({
        library_entry_id: entryId,
        duration_minutes: Number(durationMinutes),
        session_date: sessionDate,
        location_or_chapter: chapter.trim() || null,
        notes: notes.trim() || null,
      });

      addToast({
        tone: 'success',
        title: 'Playtime Logged',
        message: `Successfully recorded ${durationMinutes}m of play session history.`,
      });
      onClose();
    } catch {
      addToast({
        tone: 'error',
        title: 'Logging Failed',
        message: 'Could not record manual session.',
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
            <Clock className="h-5 w-5" />
            <h3 className="font-headline text-headline-sm font-bold text-on-background">
              Log Past Playtime
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                Duration (minutes)
              </label>
              <input
                data-nav-item="true"
                type="number"
                min="1"
                max="1440"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                required
                className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>

            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                Date Played
              </label>
              <input
                data-nav-item="true"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Chapter / Location (optional)
            </label>
            <input
              data-nav-item="true"
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Act 2, Leyndell, Novigrad"
              className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Session Notes (optional)
            </label>
            <textarea
              data-nav-item="true"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes on progress or achievements"
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
              disabled={logMutation.isPending}
            >
              {logMutation.isPending ? 'Logging...' : 'Save Playtime'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
