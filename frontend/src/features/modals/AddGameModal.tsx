import { useState, type FormEvent } from 'react';
import { AlertTriangle, Calendar, Check, ExternalLink, Plus, SlidersHorizontal, Star, X } from 'lucide-react';
import { GameArtwork } from '@/components/game/GameArtwork';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useAddGameMutation } from '@/hooks/queries';
import { useCreateWishlistItemMutation } from '@/hooks/queries/usePhase5Queries';
import { CheckpointApiError } from '@/services/api';
import { useToastStore } from '@/stores/toastStore';
import { soundManager } from '@/audio/soundManager';
import {
  COMPLETION_GOALS,
  OWNERSHIP_STATUSES,
  PLAYING_STATUSES,
  PRIORITY_LEVELS,
  SUPPORTED_PLATFORMS,
  type IGDBGameDetails,
  type IGDBSearchResultItem,
  type LibraryEntryRead,
  type OwnershipStatus,
  type PlayingStatus,
  type PriorityLevel,
} from '@/types';
import { cn } from '@/utils/cn';
import { formatIgdbRating, formatReleaseYear } from '@/utils/format';

const FORM_ID = 'add-game-form';

export interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchResult: IGDBSearchResultItem | null;
  details?: IGDBGameDetails | null;
  defaultOwnershipStatus?: OwnershipStatus;
  defaultPlayingStatus?: PlayingStatus;
  onAdded?: (entry: LibraryEntryRead) => void;
  onOpenExisting?: (entryId: string) => void;
}

function inferDefaultPlatform(platforms: string[]): string {
  const joined = platforms.join(' ').toLowerCase();
  if (joined.includes('pc')) return 'Steam';
  if (joined.includes('playstation')) return 'PlayStation';
  if (joined.includes('xbox')) return 'Xbox';
  if (joined.includes('switch')) return 'Nintendo Switch';
  return 'Steam';
}

interface AddGameFormProps {
  searchResult: IGDBSearchResultItem;
  details?: IGDBGameDetails | null;
  defaultOwnershipStatus: OwnershipStatus;
  defaultPlayingStatus: PlayingStatus;
  onClose: () => void;
  onAdded?: (entry: LibraryEntryRead) => void;
  onDuplicateChange: (isDup: boolean) => void;
  onPendingChange: (pending: boolean) => void;
}

function AddGameForm({
  searchResult,
  details,
  defaultOwnershipStatus,
  defaultPlayingStatus,
  onClose,
  onAdded,
  onDuplicateChange,
  onPendingChange,
}: AddGameFormProps) {
  const addMutation = useAddGameMutation();
  const createWishlistMutation = useCreateWishlistItemMutation();
  const addToast = useToastStore((s) => s.addToast);

  const resolvedPlatforms = details?.platforms ?? searchResult.platforms ?? [];

  const [playingStatus, setPlayingStatus] = useState<string>(defaultPlayingStatus);
  const [ownershipStatus, setOwnershipStatus] = useState<string>(defaultOwnershipStatus);
  const [platform, setPlatform] = useState<string>(() => inferDefaultPlatform(resolvedPlatforms));
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [completionGoal, setCompletionGoal] = useState<string>('Main Story');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [ratingValue, setRatingValue] = useState<string>('');
  const [plannedStartDate, setPlannedStartDate] = useState<string>('');
  const [targetCompletionDate, setTargetCompletionDate] = useState<string>('');
  const [customTags, setCustomTags] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState<boolean>(
    Boolean(searchResult.in_library),
  );

  const title = details?.title ?? searchResult.title;
  const coverUrl = details?.cover_url ?? searchResult.cover_url;
  const releaseYear = details?.release_date
    ? formatReleaseYear(details.release_date)
    : searchResult.release_year
      ? String(searchResult.release_year)
      : 'TBA';
  const developer = details?.developer ?? searchResult.developer;
  const ratingText = formatIgdbRating(details?.igdb_rating ?? searchResult.igdb_rating);
  const genres = details?.genres.map((g) => g.name) ?? searchResult.genres;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (plannedStartDate && targetCompletionDate && targetCompletionDate < plannedStartDate) {
      setFormError('Target completion date cannot be earlier than planned start date.');
      return;
    }

    let parsedRating: number | null = null;
    if (ratingValue.trim() !== '') {
      const n = Number(ratingValue.trim());
      if (Number.isFinite(n) && n >= 0 && n <= 10) {
        parsedRating = Math.round(n * 10) / 10;
      }
    }

    try {
      onPendingChange(true);

      // Decouple Wishlist from Library: "To Buy" status records game to dedicated Wishlist items
      if (ownershipStatus === 'To Buy') {
        await createWishlistMutation.mutateAsync({
          igdb_id: searchResult.igdb_id,
          priority,
          notes: notes.trim() || undefined,
        });

        soundManager.playDone();
        addToast({
          type: 'success',
          title: 'Added to Wishlist',
          description: `${title} (${priority} Priority) tracked on your Wishlist.`,
        });
        onClose();
        return;
      }

      const created = await addMutation.mutateAsync({
        igdb_id: searchResult.igdb_id,
        playing_status: playingStatus,
        ownership_status: ownershipStatus,
        platform,
        priority,
        completion_goal: completionGoal,
        progress_pct: Math.round(progressPct),
        personal_rating: parsedRating,
        planned_start_date: plannedStartDate || null,
        target_completion_date: targetCompletionDate || null,
        custom_tags: customTags.trim(),
        notes: notes.trim(),
      });

      soundManager.playDone();
      addToast({
        type: 'success',
        title: 'Added to My Library',
        description: `${created.game.title} (${created.playing_status} · ${created.ownership_status})`,
      });
      onClose();
      onAdded?.(created);
    } catch (err) {
      if (err instanceof CheckpointApiError && err.isDuplicateError) {
        setDuplicateConflict(true);
        onDuplicateChange(true);
        setFormError(
          ownershipStatus === 'To Buy'
            ? `${title} is already on your wishlist.`
            : `${title} is already in your personal library.`
        );
      } else {
        setFormError(
          err instanceof CheckpointApiError
            ? err.message
            : ownershipStatus === 'To Buy'
              ? 'Unable to add game to wishlist.'
              : 'Unable to import game from IGDB.'
        );
      }
    } finally {
      onPendingChange(false);
    }
  };

  return (
    <form id={FORM_ID} onSubmit={(e) => void handleSubmit(e)} className="grid gap-5 md:grid-cols-[175px_1fr]">
      {/* Left: Game Preview Summary */}
      <div className="space-y-3">
        <div className="w-36 sm:w-40 md:w-full mx-auto overflow-hidden rounded-xl border border-outline/75 shadow-card">
          <GameArtwork src={coverUrl} alt={title} aspect="portrait" className="w-full" />
        </div>

        <div className="space-y-1.5">
          <h3 className="font-headline text-headline-sm text-on-background leading-snug">
            {title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {releaseYear}
            </span>
            {ratingText && (
              <span className="inline-flex items-center gap-1 text-accent-gold font-semibold tabular-nums">
                <Star className="h-3.5 w-3.5 fill-accent-gold" />
                {ratingText}
              </span>
            )}
          </div>
          {developer && <p className="text-body-sm text-on-surface/85">{developer}</p>}
        </div>

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {genres.slice(0, 4).map((genre) => (
              <Badge key={genre} tone="outline" size="sm">
                {genre}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Right: Independent Status & Goal Configuration */}
      <div className="space-y-4">
        {duplicateConflict && (
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/45 bg-warning/10 p-3.5 text-body-sm text-on-surface">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <span>
              This title already exists in your library. Open its existing record to modify
              status, ownership, or wishlist state without duplicating metadata.
            </span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Playing Status"
            value={playingStatus}
            onChange={(e) => setPlayingStatus(e.target.value)}
            options={PLAYING_STATUSES.map((s) => ({ value: s, label: s }))}
          />

          <Select
            label="Ownership Status (Default: Unknown)"
            value={ownershipStatus}
            onChange={(e) => setOwnershipStatus(e.target.value)}
            options={OWNERSHIP_STATUSES.map((o) => ({ value: o, label: o }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Storefront / Platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            options={SUPPORTED_PLATFORMS.map((p) => ({ value: p, label: p }))}
          />

          <Select
            label="Completion Goal"
            value={completionGoal}
            onChange={(e) => setCompletionGoal(e.target.value)}
            options={COMPLETION_GOALS.map((g) => ({ value: g, label: g }))}
          />
        </div>

        {/* 3-State Priority Selector */}
        <div className="space-y-1.5">
          <span className="text-label-sm text-muted font-medium">Priority Level</span>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITY_LEVELS.map((level) => {
              const active = priority === level;
              return (
                <button
                  key={level}
                  type="button"
                  data-nav-item="true"
                  aria-pressed={active}
                  onClick={() => setPriority(level)}
                  className={cn(
                    'rounded-lg border py-2 text-label-md transition-all duration-state-change',
                    active
                      ? 'bg-accent-active/20 border-accent-active text-on-background font-semibold'
                      : 'bg-surface/75 border-outline text-muted hover:text-on-surface hover:border-outline/95',
                  )}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        {/* Completion Progress & Personal Rating */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="add-progress-input" className="text-label-sm text-muted font-medium flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-accent-active" />
                <span>Completion Progress</span>
              </label>
              <span className="tabular-nums text-[12px] font-semibold text-accent-active">{Math.round(progressPct)}%</span>
            </div>
            <input
              id="add-progress-input"
              data-nav-item="true"
              type="range"
              min={0}
              max={100}
              value={progressPct}
              onChange={(e) => setProgressPct(Number(e.target.value))}
              className="w-full accent-[var(--accent-active)] cursor-pointer"
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
                value={ratingValue}
                onChange={(e) => setRatingValue(e.target.value)}
                leftAdornment={<Star className="h-4 w-4 text-accent-gold" />}
                placeholder="Unrated"
              />
            </div>
            {ratingValue !== '' && (
              <Button
                variant="ghost"
                size="md"
                leftIcon={<X className="h-3.5 w-3.5" />}
                onClick={() => setRatingValue('')}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            label="Planned Start Date (optional)"
            value={plannedStartDate}
            onChange={(d) => setPlannedStartDate(d ?? '')}
            maxDate={targetCompletionDate || undefined}
          />

          <DatePicker
            label="Target Completion Date (optional)"
            value={targetCompletionDate}
            onChange={(d) => setTargetCompletionDate(d ?? '')}
            minDate={plannedStartDate || undefined}
          />
        </div>

        <Input
          label="Custom Tags (comma-separated, optional)"
          value={customTags}
          onChange={(e) => setCustomTags(e.target.value)}
          placeholder="e.g., Soulslike, Co-op, Deck Verified"
        />

        <div className="space-y-1.5">
          <label htmlFor="add-game-notes" className="text-label-sm text-muted font-medium">
            Short Note (optional)
          </label>
          <textarea
            id="add-game-notes"
            data-nav-item="true"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why are you tracking or playing this game?"
            className="w-full rounded-lg bg-surface/90 border border-outline px-3 py-2 text-body-md text-on-surface placeholder:text-muted/60 focus:border-accent-active focus:outline-none resize-y"
          />
        </div>

        {formError && (
          <p className="rounded-lg border border-error/45 bg-error/10 px-3.5 py-2 text-body-sm text-error">
            {formError}
          </p>
        )}
      </div>
    </form>
  );
}

export function AddGameModal({
  isOpen,
  onClose,
  searchResult,
  details,
  defaultOwnershipStatus = 'Unknown',
  defaultPlayingStatus = 'Planned',
  onAdded,
  onOpenExisting,
}: AddGameModalProps) {
  const [isPending, setIsPending] = useState(false);
  const [isDupOverride, setIsDupOverride] = useState(false);

  if (!searchResult || !isOpen) return null;

  const isDuplicate = Boolean(searchResult.in_library) || isDupOverride;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Game to Checkpoint"
      subtitle="Decouple how you own this game from how you plan to play it"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {searchResult.library_entry_id && onOpenExisting && (
            <Button
              variant="secondary"
              leftIcon={<ExternalLink className="h-4 w-4" />}
              onClick={() => {
                onClose();
                onOpenExisting(searchResult.library_entry_id!);
              }}
            >
              Open Existing Entry
            </Button>
          )}
          <Button
            type="submit"
            form={FORM_ID}
            variant="accent"
            disabled={isDuplicate}
            isLoading={isPending}
            leftIcon={isDuplicate ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          >
            {isDuplicate ? 'Already in Library' : 'Confirm & Import'}
          </Button>
        </>
      }
    >
      <AddGameForm
        key={`${searchResult.igdb_id}-${defaultOwnershipStatus}-${defaultPlayingStatus}`}
        searchResult={searchResult}
        details={details}
        defaultOwnershipStatus={defaultOwnershipStatus}
        defaultPlayingStatus={defaultPlayingStatus}
        onClose={onClose}
        onAdded={onAdded}
        onDuplicateChange={setIsDupOverride}
        onPendingChange={setIsPending}
      />
    </Modal>
  );
}
