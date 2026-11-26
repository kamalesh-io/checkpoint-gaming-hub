import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  Edit2,
  Eye,
  EyeOff,
  Filter,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { JournalEditorModal } from '@/features/journal/JournalEditorModal';
import {
  useDeleteJournalEntryMutation,
  useJournalListQuery,
  useLibraryQuery,
} from '@/hooks/queries';
import { buildGameDetailsRoute } from '@/routes/routes';
import { useToastStore } from '@/stores/toastStore';
import type { JournalEntryRead } from '@/types';
import { formatShortDate } from '@/utils/format';

export function JournalPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedGameId, setSelectedGameId] = useState<string>('all');
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntryRead | null>(null);

  const { data: entries, isLoading, isError, refetch } = useJournalListQuery();
  const { data: libraryData } = useLibraryQuery({ limit: 100 });
  const deleteMutation = useDeleteJournalEntryMutation();

  const libraryEntries = libraryData?.data ?? [];

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e) => {
      if (selectedType !== 'all' && e.entry_type !== selectedType) return false;
      if (selectedGameId !== 'all' && e.library_entry_id !== selectedGameId) return false;
      return true;
    });
  }, [entries, selectedType, selectedGameId]);

  const toggleSpoilerReveal = (id: string) => {
    setRevealedSpoilers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this journal entry?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      addToast({ tone: 'neutral', title: 'Entry Deleted', message: 'Journal entry removed.' });
    } catch {
      addToast({ tone: 'error', title: 'Delete Failed', message: 'Could not delete entry.' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-darker/60" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to Load Journal"
          message="Could not retrieve journal entries from SQLite database."
          onRetry={() => refetch()}
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
              Gaming Journal & Diary
            </h1>
            <Badge tone="accent" size="sm">
              {entries?.length ?? 0} {entries?.length === 1 ? 'Entry' : 'Entries'}
            </Badge>
          </div>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Record playthrough reflections, strategies, boss victories, and spoiler-safe reviews.
          </p>
        </div>

        <Button
          data-nav-item="true"
          variant="primary"
          onClick={() => {
            setEditingEntry(null);
            setIsEditorOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Write Journal Entry
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-outline/65 bg-surface-darker/60 p-4">
        <div className="flex items-center gap-2 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
          <Filter className="h-4 w-4 text-accent-primary" />
          Filter Feed:
        </div>

        {/* Type Filter */}
        <select
          data-nav-item="true"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="rounded-xl border border-outline/70 bg-surface-dark px-3 py-1.5 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="all">All Types</option>
          <option value="Note">Playthrough Notes</option>
          <option value="Review">Reviews</option>
          <option value="Milestone">Milestones</option>
          <option value="Boss Fight">Boss Encounters</option>
          <option value="Session Summary">Session Summaries</option>
        </select>

        {/* Game Filter */}
        <select
          data-nav-item="true"
          value={selectedGameId}
          onChange={(e) => setSelectedGameId(e.target.value)}
          className="rounded-xl border border-outline/70 bg-surface-dark px-3 py-1.5 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="all">All Games</option>
          {libraryEntries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.game.title}
            </option>
          ))}
        </select>

        {(selectedType !== 'all' || selectedGameId !== 'all') && (
          <Button
            data-nav-item="true"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedType('all');
              setSelectedGameId('all');
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Journal Entries Feed */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          title="No Journal Entries Found"
          message={
            entries && entries.length > 0
              ? 'No entries match your selected filter.'
              : 'Keep a personal gaming log of your favorite games, boss encounters, and reflections.'
          }
          actionLabel="Write Your First Entry"
          onAction={() => {
            setEditingEntry(null);
            setIsEditorOpen(true);
          }}
        />
      ) : (
        <div className="space-y-5">
          {filteredEntries.map((entry) => {
            const isRevealed = Boolean(revealedSpoilers[entry.id]);
            const isSpoilerBlur = entry.is_spoiler && !isRevealed;

            return (
              <div
                key={entry.id}
                data-nav-item="true"
                tabIndex={0}
                className="group relative rounded-2xl border border-outline/70 bg-secondary-background/85 p-6 shadow-sm transition-all hover:border-accent-primary/60 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                {/* Entry Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-outline/50 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-headline text-headline-sm font-bold text-on-background">
                      {entry.title}
                    </h3>
                    <Badge tone="accent" size="sm">
                      {entry.entry_type}
                    </Badge>
                    {entry.is_spoiler && (
                      <Badge tone="warning" size="sm" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Spoiler
                      </Badge>
                    )}
                    {entry.personal_rating !== null && (
                      <span className="flex items-center gap-1 font-bold text-accent-gold text-label-md">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {entry.personal_rating}/10
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-caption text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatShortDate(entry.created_at)}
                    </span>

                    <button
                      data-nav-item="true"
                      onClick={() => {
                        setEditingEntry(entry);
                        setIsEditorOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background"
                      title="Edit Entry"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      data-nav-item="true"
                      onClick={() => handleDelete(entry.id)}
                      className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-error"
                      title="Delete Entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Associated Game Tag */}
                {entry.library_entry && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-caption text-on-surface-variant">Game:</span>
                    <button
                      data-nav-item="true"
                      onClick={() => navigate(buildGameDetailsRoute(entry.library_entry_id!))}
                      className="text-label-sm font-semibold text-accent-primary hover:underline"
                    >
                      {entry.library_entry.game.title}
                    </button>
                  </div>
                )}

                {/* Entry Content (with Spoiler Protection) */}
                <div className="relative mt-4">
                  {isSpoilerBlur ? (
                    <div className="relative rounded-xl border border-warning/30 bg-surface-darker/90 p-6 text-center backdrop-blur-md">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="h-8 w-8 text-warning" />
                        <h4 className="font-headline text-body-lg font-bold text-on-background">
                          Spoiler Alert
                        </h4>
                        <p className="text-body-sm text-on-surface-variant max-w-md">
                          This entry contains major plot or ending spoilers. Click below to reveal
                          the content.
                        </p>
                        <Button
                          data-nav-item="true"
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleSpoilerReveal(entry.id)}
                          className="mt-2 text-warning hover:bg-warning/10"
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          Reveal Spoiler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-body-md text-on-background whitespace-pre-line leading-relaxed">
                        {entry.content_markdown ?? entry.content}
                      </p>
                      {entry.is_spoiler && (
                        <div className="mt-3 flex justify-end">
                          <button
                            data-nav-item="true"
                            onClick={() => toggleSpoilerReveal(entry.id)}
                            className="flex items-center gap-1 text-caption text-on-surface-variant hover:text-warning"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            Hide Spoiler
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      <JournalEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        entryToEdit={editingEntry}
      />
    </div>
  );
}
