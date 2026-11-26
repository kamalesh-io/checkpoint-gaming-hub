import { useState, type FormEvent } from 'react';
import { AlertCircle, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useCreateJournalEntryMutation,
  useLibraryQuery,
  useUpdateJournalEntryMutation,
} from '@/hooks/queries';
import { useToastStore } from '@/stores/toastStore';
import type { JournalEntryRead } from '@/types';

interface JournalEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryToEdit?: JournalEntryRead | null;
  preselectedEntryId?: string;
}

export function JournalEditorModal({
  isOpen,
  onClose,
  entryToEdit,
  preselectedEntryId,
}: JournalEditorModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const { data: libraryData } = useLibraryQuery({ limit: 100 });
  const createMutation = useCreateJournalEntryMutation();
  const updateMutation = useUpdateJournalEntryMutation();

  const [title, setTitle] = useState(entryToEdit?.title ?? '');
  const [libraryEntryId, setLibraryEntryId] = useState(
    entryToEdit?.library_entry_id ?? preselectedEntryId ?? '',
  );
  const [entryType, setEntryType] = useState(entryToEdit?.entry_type ?? 'Note');
  const [personalRating, setPersonalRating] = useState<number | ''>(
    entryToEdit?.personal_rating ?? '',
  );
  const [isSpoiler, setIsSpoiler] = useState(entryToEdit?.is_spoiler ?? false);
  const [content, setContent] = useState(
    entryToEdit?.content_markdown ?? entryToEdit?.content ?? '',
  );

  if (!isOpen) return null;

  const libraryEntries = libraryData?.data ?? [];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      if (entryToEdit) {
        await updateMutation.mutateAsync({
          id: entryToEdit.id,
          payload: {
            title: title.trim(),
            content_markdown: content.trim(),
            entry_type: entryType,
            personal_rating: personalRating !== '' ? Number(personalRating) : null,
            is_spoiler: isSpoiler,
          },
        });
        addToast({ tone: 'success', title: 'Journal Updated', message: 'Changes saved.' });
      } else {
        await createMutation.mutateAsync({
          title: title.trim(),
          content_markdown: content.trim(),
          library_entry_id: libraryEntryId || null,
          entry_type: entryType,
          personal_rating: personalRating !== '' ? Number(personalRating) : null,
          is_spoiler: isSpoiler,
        });
        addToast({ tone: 'success', title: 'Journal Entry Added', message: 'Entry saved.' });
      }
      onClose();
    } catch {
      addToast({ tone: 'error', title: 'Save Failed', message: 'Could not save journal entry.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded-2xl border border-outline/80 bg-surface-darker p-6 shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between border-b border-outline/70 pb-3">
          <div className="flex items-center gap-2 text-accent-primary">
            <BookOpen className="h-5 w-5" />
            <h3 className="font-headline text-headline-sm font-bold text-on-background">
              {entryToEdit ? 'Edit Journal Entry' : 'New Journal Entry'}
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Title
            </label>
            <input
              data-nav-item="true"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Malenia Defeated, Act 1 Review, Final Thoughts"
              className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                Associated Game (optional)
              </label>
              <select
                data-nav-item="true"
                value={libraryEntryId}
                onChange={(e) => setLibraryEntryId(e.target.value)}
                className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
              >
                <option value="">General Gaming Reflection</option>
                {libraryEntries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.game.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                Entry Type
              </label>
              <select
                data-nav-item="true"
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
              >
                <option value="Note">Playthrough Note</option>
                <option value="Review">Game Review</option>
                <option value="Milestone">Milestone Achieved</option>
                <option value="Boss Fight">Boss Encounter</option>
                <option value="Session Summary">Session Summary</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                Rating (0–10, optional)
              </label>
              <input
                data-nav-item="true"
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={personalRating}
                onChange={(e) => setPersonalRating(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 9.5"
                className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-body-sm text-warning font-medium">
                <input
                  data-nav-item="true"
                  type="checkbox"
                  checked={isSpoiler}
                  onChange={(e) => setIsSpoiler(e.target.checked)}
                  className="rounded border-outline/70 bg-surface-dark text-warning focus:ring-warning"
                />
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  Contains Story Spoilers
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Journal Content
            </label>
            <textarea
              data-nav-item="true"
              rows={8}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your impressions, strategies, favorite dialogue, or critique..."
              className="w-full rounded-xl border border-outline/70 bg-surface-dark p-3 text-body-sm text-on-background placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary leading-relaxed"
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
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {entryToEdit ? 'Save Changes' : 'Publish Entry'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
