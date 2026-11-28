import { useState, type FormEvent } from 'react';
import { SlidersHorizontal, Star, X } from 'lucide-react';
import { GameArtwork } from '@/components/game/GameArtwork';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Select';
import { useUpdateGameMutation } from '@/hooks/queries';
import { CheckpointApiError } from '@/services/api';
import { useToastStore } from '@/stores/toastStore';
import { soundManager } from '@/audio/soundManager';
import {
  COMPLETION_GOALS,
  PLAYING_STATUSES,
  type LibraryEntryRead,
} from '@/types';

const FORM_ID = 'update-progress-form';

export interface UpdateProgressModalProps {
  entry: LibraryEntryRead | null;
  isOpen: boolean;
  onClose: () => void;
}

function UpdateProgressForm({
  entry,
  onClose,
  onPendingChange,
}: {
  entry: LibraryEntryRead;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const updateMutation = useUpdateGameMutation();
  const addToast = useToastStore((s) => s.addToast);

  const [progressPct, setProgressPct] = useState<number>(entry.progress_pct);
  const [playingStatus, setPlayingStatus] = useState<string>(entry.playing_status);
  const [completionGoal, setCompletionGoal] = useState<string>(entry.completion_goal);
  const [ratingInput, setRatingInput] = useState<string>(
    entry.personal_rating !== null && entry.personal_rating !== undefined
      ? String(entry.personal_rating)
      : '',
  );
  const [notes, setNotes] = useState<string>(entry.notes ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!Number.isFinite(progressPct) || progressPct < 0 || progressPct > 100) {
      setFormError('Progress percentage must be between 0 and 100.');
      return;
    }

    let parsedRating: number | null = null;
    if (ratingInput.trim() !== '') {
      const n = Number(ratingInput.trim());
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        setFormError('Personal rating must be between 0 and 10.');
        return;
      }
      parsedRating = Math.round(n * 10) / 10;
    }

    try {
      onPendingChange(true);
      await updateMutation.mutateAsync({
        entryId: entry.id,
        updates: {
          progress_pct: Math.round(progressPct),
          playing_status: playingStatus,
          completion_goal: completionGoal,
          personal_rating: parsedRating,
          notes,
        },
      });
      soundManager.playDone();
      addToast({
        type: 'success',
        title: 'Progress updated',
        description: `${entry.game.title} saved (${Math.round(progressPct)}% · ${playingStatus}).`,
      });
      onClose();
    } catch (err) {
      setFormError(
        err instanceof CheckpointApiError ? err.message : 'Failed to update progress.',
      );
    } finally {
      onPendingChange(false);
    }
  };

  const coverUrl = entry.artwork?.cover_url ?? null;

  return (
    <form id={FORM_ID} onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-outline/75 bg-surface/55 p-3.5">
        <GameArtwork
          src={coverUrl}
          alt={entry.game.title}
          aspect="portrait"
          className="w-14 rounded-lg shrink-0"
          showTitleOnFallback={false}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-headline text-headline-sm text-on-background truncate">
              {entry.game.title}
            </p>
            <Badge tone="neutral" size="sm">
              {entry.platform}
            </Badge>
          </div>
          <ProgressBar
            value={progressPct}
            label={progressPct === 0 ? 'Unrecorded / Not Started' : 'Campaign Completion'}
            showPercentage
            height="sm"
          />
        </div>
      </div>

      {/* Slider & Number */}
      <div className="space-y-2.5 rounded-xl border border-outline/70 bg-surface/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="progress-slider"
            className="text-label-md text-on-surface font-medium flex items-center gap-2"
          >
            <SlidersHorizontal className="h-4 w-4 text-accent-active" />
            <span>Completion Percentage</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              data-nav-item="true"
              min={0}
              max={100}
              value={progressPct}
              onChange={(e) => {
                const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                setProgressPct(val);
              }}
              aria-label="Progress percentage number"
              className="w-16 rounded-md bg-secondary-background border border-outline px-2 py-1 text-right text-body-md tabular-nums text-on-background focus:border-accent-active focus:outline-none"
            />
            <span className="text-body-sm text-muted">%</span>
          </div>
        </div>

        <input
          id="progress-slider"
          data-nav-item="true"
          type="range"
          min={0}
          max={100}
          value={progressPct}
          onChange={(e) => setProgressPct(Number(e.target.value))}
          className="w-full accent-[var(--accent-active)] cursor-pointer"
        />

        <div className="flex flex-wrap gap-2 pt-1">
          {[0, 25, 50, 75, 100].map((preset) => (
            <button
              key={preset}
              type="button"
              data-nav-item="true"
              onClick={() => {
                setProgressPct(preset);
                if (preset === 100 && playingStatus !== '100% Completed') {
                  setPlayingStatus('Completed');
                }
              }}
              className="rounded-md border border-outline/75 bg-secondary-background/80 px-2.5 py-1 text-[12px] font-medium tabular-nums text-muted hover:text-on-background hover:border-accent-active/60 transition-colors"
            >
              {preset === 0 ? 'Reset (0%)' : `${preset}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Playing Status"
          value={playingStatus}
          onChange={(e) => setPlayingStatus(e.target.value)}
          options={PLAYING_STATUSES.map((s) => ({ value: s, label: s }))}
        />

        <Select
          label="Completion Goal"
          value={completionGoal}
          onChange={(e) => setCompletionGoal(e.target.value)}
          options={COMPLETION_GOALS.map((g) => ({ value: g, label: g }))}
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Personal Rating (0 – 10, optional)"
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={ratingInput}
            onChange={(e) => setRatingInput(e.target.value)}
            leftAdornment={<Star className="h-4 w-4 text-accent-gold" />}
            placeholder="Leave blank if unrated"
          />
        </div>
        {ratingInput !== '' && (
          <Button
            variant="ghost"
            size="md"
            leftIcon={<X className="h-3.5 w-3.5" />}
            onClick={() => setRatingInput('')}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="progress-notes" className="text-label-sm text-muted font-medium">
          Progress / Playthrough Note
        </label>
        <textarea
          id="progress-notes"
          data-nav-item="true"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Record where you paused, next objective, or boss milestone..."
          className="w-full rounded-lg bg-surface/90 border border-outline px-3 py-2 text-body-md text-on-surface placeholder:text-muted/60 focus:border-accent-active focus:outline-none resize-y"
        />
      </div>

      {formError && (
        <p className="rounded-lg border border-error/45 bg-error/10 px-3.5 py-2 text-body-sm text-error">
          {formError}
        </p>
      )}
    </form>
  );
}

export function UpdateProgressModal({ entry, isOpen, onClose }: UpdateProgressModalProps) {
  const [isPending, setIsPending] = useState(false);

  if (!entry || !isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Game Progress"
      subtitle={entry.game.title}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} variant="accent" isLoading={isPending}>
            Save Progress
          </Button>
        </>
      }
    >
      <UpdateProgressForm
        key={`${entry.id}-${entry.updated_at}`}
        entry={entry}
        onClose={onClose}
        onPendingChange={setIsPending}
      />
    </Modal>
  );
}
