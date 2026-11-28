import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gamepad2,
  Heart,
  Image as ImageIcon,
  Keyboard,
  NotebookPen,
  Play,
  Save,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { GameArtwork } from '@/components/game/GameArtwork';
import { GameLogo } from '@/components/game/GameLogo';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Select';
import { HeroSkeleton, Skeleton } from '@/components/ui/Skeleton';
import {
  OwnershipStatusBadge,
  PlayingStatusBadge,
  PriorityBadge,
} from '@/components/ui/StatusBadge';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { ArtworkSelectorModal } from '@/features/modals/ArtworkSelectorModal';
import { UpdateProgressModal } from '@/features/modals/UpdateProgressModal';
import { JournalEditorModal } from '@/features/journal/JournalEditorModal';
import { StartSessionModal } from '@/features/sessions/StartSessionModal';
import { GameAchievementsTab } from '@/features/achievements/GameAchievementsTab';
import { LaunchConfigModal } from '@/features/launcher/LaunchConfigModal';
import {
  useGameJournalQuery,
  useLibraryEntryQuery,
  useRemoveGameMutation,
  useUpdateGameMutation,
} from '@/hooks/queries';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { useGameThemeSync } from '@/hooks/useGameThemeSync';
import { CONTROLLER_CUSTOM_EVENT } from '@/hooks/useSpatialNavigation';
import { ROUTES } from '@/routes/routes';
import { CheckpointApiError } from '@/services/api';
import type { ControllerActionEvent } from '@/services/gamepad/types';
import { useControllerStore } from '@/stores/controllerStore';
import { useToastStore } from '@/stores/toastStore';
import {
  COMPLETION_GOALS,
  OWNERSHIP_STATUSES,
  PLAYING_STATUSES,
  PRIORITY_LEVELS,
  SUPPORTED_PLATFORMS,
  type LibraryEntryRead,
  type PriorityLevel,
} from '@/types';
import { cn } from '@/utils/cn';
import {
  formatHoursLogged,
  formatIgdbRating,
  formatPersonalRating,
  formatReleaseYear,
  formatShortDate,
  splitCustomTags,
} from '@/utils/format';

type DetailTabId =
  | 'overview'
  | 'progress'
  | 'notes'
  | 'screenshots'
  | 'sessions'
  | 'achievements';

function YourJourneySidebar({
  entry,
  onSavePatch,
  isSaving,
}: {
  entry: LibraryEntryRead;
  onSavePatch: (updates: Record<string, unknown>, message: string) => Promise<void>;
  isSaving: boolean;
}) {
  const [progressPct, setProgressPct] = useState(entry.progress_pct);
  const [plannedStartDate, setPlannedStartDate] = useState(entry.planned_start_date ?? '');
  const [targetCompletionDate, setTargetCompletionDate] = useState(
    entry.target_completion_date ?? '',
  );
  const [customTags, setCustomTags] = useState(entry.custom_tags ?? '');
  const [ratingValue, setRatingValue] = useState(
    entry.personal_rating !== null && entry.personal_rating !== undefined
      ? String(entry.personal_rating)
      : '',
  );
  const [dateError, setDateError] = useState<string | null>(null);

  const handleSaveTimelineAndMeta = async (e: FormEvent) => {
    e.preventDefault();
    setDateError(null);

    if (plannedStartDate && targetCompletionDate && targetCompletionDate < plannedStartDate) {
      setDateError('Target completion date must be on or after planned start date.');
      return;
    }

    let parsedRating: number | null = null;
    if (ratingValue.trim() !== '') {
      const n = Number(ratingValue.trim());
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        setDateError('Personal rating must be between 0 and 10.');
        return;
      }
      parsedRating = Math.round(n * 10) / 10;
    }

    await onSavePatch(
      {
        progress_pct: Math.round(progressPct),
        planned_start_date: plannedStartDate || null,
        target_completion_date: targetCompletionDate || null,
        custom_tags: customTags.trim(),
        personal_rating: parsedRating,
      },
      'Journey details saved',
    );
  };

  return (
    <aside className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-5 space-y-5 shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-outline/65 pb-3">
        <h2 className="font-headline text-headline-md text-on-background">Your Journey</h2>
        <Badge tone="accent" size="sm">
          SQLite Local
        </Badge>
      </div>

      {/* Immediate Selectors */}
      <div className="space-y-3.5">
        <Select
          label="Playing Status"
          value={entry.playing_status}
          disabled={isSaving}
          onChange={(e) =>
            void onSavePatch(
              { playing_status: e.target.value },
              `Playing status set to ${e.target.value}`,
            )
          }
          options={PLAYING_STATUSES.map((s) => ({ value: s, label: s }))}
        />

        <Select
          label="Ownership Status"
          value={entry.ownership_status}
          disabled={isSaving}
          onChange={(e) =>
            void onSavePatch(
              { ownership_status: e.target.value },
              `Ownership set to ${e.target.value}`,
            )
          }
          options={OWNERSHIP_STATUSES.map((o) => ({ value: o, label: o }))}
        />

        <Select
          label="Platform / Storefront"
          value={entry.platform}
          disabled={isSaving}
          onChange={(e) =>
            void onSavePatch({ platform: e.target.value }, `Platform set to ${e.target.value}`)
          }
          options={Array.from(new Set([...SUPPORTED_PLATFORMS, entry.platform])).map((p) => ({
            value: p,
            label: p,
          }))}
        />

        <Select
          label="Completion Goal"
          value={entry.completion_goal}
          disabled={isSaving}
          onChange={(e) =>
            void onSavePatch(
              { completion_goal: e.target.value },
              `Goal set to ${e.target.value}`,
            )
          }
          options={COMPLETION_GOALS.map((g) => ({ value: g, label: g }))}
        />

        {/* Campaign Completion Progress Slider */}
        <div className="space-y-2 rounded-xl border border-outline/70 bg-surface/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-label-sm text-muted font-medium flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-accent-active" />
              <span>Completion Progress</span>
            </span>
            <span className="tabular-nums text-label-md font-bold text-accent-active">
              {Math.round(progressPct)}%
            </span>
          </div>
          <input
            type="range"
            data-nav-item="true"
            min={0}
            max={100}
            value={progressPct}
            disabled={isSaving}
            onChange={(e) => setProgressPct(Number(e.target.value))}
            className="w-full accent-[var(--accent-active)] cursor-pointer"
          />
          <div className="flex items-center justify-between gap-1 pt-0.5">
            {[0, 25, 50, 75, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                data-nav-item="true"
                disabled={isSaving}
                onClick={() => {
                  setProgressPct(preset);
                  void onSavePatch(
                    { progress_pct: preset },
                    `Progress set to ${preset}%`,
                  );
                }}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors',
                  progressPct === preset
                    ? 'bg-accent-active text-on-accent-active'
                    : 'bg-secondary-background text-muted hover:text-on-surface border border-outline/60',
                )}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>

        {/* 3-Button Priority Selector */}
        <div className="space-y-1.5">
          <span className="text-label-sm text-muted font-medium">Priority Level</span>
          <div className="grid grid-cols-3 gap-1.5">
            {PRIORITY_LEVELS.map((level: PriorityLevel) => {
              const active = entry.priority === level;
              return (
                <button
                  key={level}
                  type="button"
                  data-nav-item="true"
                  disabled={isSaving}
                  aria-pressed={active}
                  onClick={() =>
                    void onSavePatch({ priority: level }, `Priority set to ${level}`)
                  }
                  className={cn(
                    'rounded-lg border py-1.5 text-label-sm transition-colors',
                    active
                      ? 'bg-accent-active/20 border-accent-active text-on-background font-semibold'
                      : 'bg-surface/70 border-outline text-muted hover:text-on-surface',
                  )}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Explicit Save Timeline, Rating & Custom Tags */}
      <form
        onSubmit={(e) => void handleSaveTimelineAndMeta(e)}
        className="space-y-3 border-t border-outline/65 pt-4"
      >
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Personal Rating (0 – 10)"
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={ratingValue}
              onChange={(e) => setRatingValue(e.target.value)}
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

        <DatePicker
          label="Planned Start Date"
          value={plannedStartDate}
          onChange={(d) => setPlannedStartDate(d ?? '')}
          maxDate={targetCompletionDate || undefined}
        />

        <DatePicker
          label="Target Completion Date"
          value={targetCompletionDate}
          onChange={(d) => setTargetCompletionDate(d ?? '')}
          minDate={plannedStartDate || undefined}
        />

        <Input
          label="Custom Tags"
          value={customTags}
          onChange={(e) => setCustomTags(e.target.value)}
          placeholder="e.g., Cozy, Story Rich"
        />

        {dateError && <p className="text-body-sm text-error">{dateError}</p>}

        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="w-full"
          isLoading={isSaving}
          leftIcon={<Save className="h-3.5 w-3.5" />}
        >
          Save Journey Metadata
        </Button>
      </form>
    </aside>
  );
}

function NotesTabEditor({
  entry,
  onSaveNotes,
  isSaving,
}: {
  entry: LibraryEntryRead;
  onSaveNotes: (notes: string) => Promise<void>;
  isSaving: boolean;
}) {
  const openVirtualKeyboard = useControllerStore((s) => s.openVirtualKeyboard);
  const [notesDraft, setNotesDraft] = useState(entry.notes ?? '');
  const isDirty = notesDraft !== (entry.notes ?? '');

  return (
    <div className="rounded-2xl border border-outline/75 bg-secondary-background/80 p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <NotebookPen className="h-5 w-5 text-accent-active" />
          <h3 className="font-headline text-headline-md text-on-background">
            Game Playthrough Notes
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Keyboard className="h-4 w-4" />}
            onClick={() =>
              openVirtualKeyboard({
                id: `notes-${entry.id}`,
                label: `Notes: ${entry.game.title}`,
                initialValue: notesDraft,
                placeholder: 'Enter strategy, build, or milestone note...',
                onChange: (val) => setNotesDraft(val),
                onSubmit: (val) => {
                  setNotesDraft(val);
                  void onSaveNotes(val);
                },
              })
            }
          >
            On-Screen Keyboard
          </Button>
          <Button
            variant="accent"
            size="sm"
            disabled={!isDirty}
            isLoading={isSaving}
            leftIcon={<Save className="h-4 w-4" />}
            onClick={() => void onSaveNotes(notesDraft)}
          >
            {isDirty ? 'Save Notes' : 'Saved'}
          </Button>
        </div>
      </div>

      <textarea
        data-nav-item="true"
        rows={6}
        value={notesDraft}
        onChange={(e) => setNotesDraft(e.target.value)}
        placeholder="Capture build ideas, boss strategies, mod lists, or where you paused..."
        className="w-full rounded-xl bg-surface/80 border border-outline px-4 py-3 text-body-md text-on-surface placeholder:text-muted/60 focus:border-accent-active focus:outline-none resize-y leading-relaxed"
      />

      {/* Journal Entries for this game */}
      <JournalSection entryId={entry.id} />
    </div>
  );
}

function JournalSection({ entryId }: { entryId: string }) {
  const { data: journalEntries } = useGameJournalQuery(entryId);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  return (
    <div className="pt-4 border-t border-outline/60 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-headline text-headline-sm font-bold text-on-background">
            Gaming Journal Logs
          </h4>
          <p className="text-body-sm text-on-surface-variant">
            Timestamped reflections, boss encounters, and reviews for this game.
          </p>
        </div>

        <Button
          data-nav-item="true"
          variant="secondary"
          size="sm"
          onClick={() => setIsEditorOpen(true)}
        >
          Add Journal Entry
        </Button>
      </div>

      {(!journalEntries || journalEntries.length === 0) ? (
        <p className="text-body-sm text-muted italic">
          No journal entries written for this game yet.
        </p>
      ) : (
        <div className="space-y-3">
          {journalEntries.map((j) => (
            <div
              key={j.id}
              className="rounded-xl border border-outline/60 bg-surface-dark/60 p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-headline text-body-md font-bold text-on-background">
                    {j.title}
                  </span>
                  <Badge tone="accent" size="sm">
                    {j.entry_type}
                  </Badge>
                  {j.is_spoiler && (
                    <Badge tone="warning" size="sm">
                      Spoiler
                    </Badge>
                  )}
                </div>
                <span className="text-caption text-on-surface-variant">
                  {formatShortDate(j.created_at)}
                </span>
              </div>
              <p className="text-body-sm text-on-surface-variant line-clamp-3">
                {j.content_markdown ?? j.content}
              </p>
            </div>
          ))}
        </div>
      )}

      <JournalEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        preselectedEntryId={entryId}
      />
    </div>
  );
}

export function GameDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const addToast = useToastStore((s) => s.addToast);
  const inBigPicture = location.pathname.startsWith(ROUTES.BIG_PICTURE);

  const entryQuery = useLibraryEntryQuery(id);
  const updateMutation = useUpdateGameMutation();
  const removeMutation = useRemoveGameMutation();

  const entry = entryQuery.data ?? null;

  const rawHeroUrl =
    entry?.artwork?.hero_url ??
    entry?.artwork?.cover_url ??
    entry?.game.artworks.find((a) => a.asset_type === 'hero')?.remote_url ??
    null;

  const { resolvedSrc: resolvedHeroSrc } = useAuthenticatedImage(rawHeroUrl);

  useGameThemeSync({
    gameId: entry?.game_id ?? null,
    title: entry?.game.title ?? null,
    backendAccentToken: entry?.active_accent ?? null,
    resolvedArtworkSrc: resolvedHeroSrc,
    enabled: Boolean(entry),
  });

  const [activeTab, setActiveTab] = useState<DetailTabId>('overview');
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [startSessionOpen, setStartSessionOpen] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [artworkModalState, setArtworkModalState] = useState<{
    open: boolean;
    tab: 'cover' | 'hero' | 'logo';
  }>({ open: false, tab: 'cover' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    const onController = (ev: Event) => {
      const detail = (ev as CustomEvent<ControllerActionEvent>).detail;
      if (!detail || !entry || document.querySelector('[aria-modal="true"]')) return;
      if (detail.action === 'QUICK_ACTION') {
        ev.preventDefault();
        setProgressModalOpen(true);
      }
    };
    window.addEventListener(CONTROLLER_CUSTOM_EVENT, onController);
    return () => window.removeEventListener(CONTROLLER_CUSTOM_EVENT, onController);
  }, [entry]);

  const screenshots = useMemo(
    () =>
      entry?.game.artworks.filter((a) => a.asset_type === 'screenshot') ?? [],
    [entry],
  );

  if (entryQuery.isLoading) {
    return (
      <div className="space-y-6">
        <HeroSkeleton />
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-[520px] rounded-2xl" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (entryQuery.isError || !entry) {
    return (
      <div className="py-8 space-y-4">
        <Button
          variant="ghost"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(ROUTES.LIBRARY)}
        >
          Back to My Library
        </Button>
        <ErrorState
          title="Game Entry Not Found"
          message={
            entryQuery.error instanceof CheckpointApiError
              ? entryQuery.error.message
              : 'This library entry may have been removed or is unavailable.'
          }
          onRetry={() => void entryQuery.refetch()}
        />
      </div>
    );
  }

  const handlePatch = async (updates: Record<string, unknown>, message: string) => {
    try {
      await updateMutation.mutateAsync({ entryId: entry.id, updates });
      addToast({ type: 'success', title: message });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Save failed',
        description: err instanceof CheckpointApiError ? err.message : 'Unable to save update.',
      });
    }
  };

  const handleRemove = async () => {
    try {
      await removeMutation.mutateAsync(entry.id);
      addToast({
        type: 'info',
        title: 'Removed from library',
        description: `${entry.game.title} was deleted from your library.`,
      });
      navigate(inBigPicture ? `${ROUTES.BIG_PICTURE}/library` : ROUTES.LIBRARY, { replace: true });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Delete failed',
        description: err instanceof CheckpointApiError ? err.message : 'Unable to delete entry.',
      });
    }
  };

  const tabs: TabItem<DetailTabId>[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'progress', label: 'Progress' },
    { id: 'notes', label: 'Notes' },
    { id: 'screenshots', label: 'Screenshots', badge: screenshots.length },
    { id: 'sessions', label: 'Play Sessions' },
    { id: 'achievements', label: 'Achievements' },
  ];

  const coverUrl = entry.artwork?.cover_url ?? null;
  const igdbRatingText = formatIgdbRating(entry.game.igdb_rating);
  const customTagList = splitCustomTags(entry.custom_tags);

  return (
    <div className="space-y-7 pb-10">
      {/* Top Breadcrumb Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>

        <div className="flex items-center gap-2">
          <IconButton
            label={entry.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
            variant="surface"
            active={entry.is_favorite}
            onClick={() =>
              void handlePatch(
                { is_favorite: !entry.is_favorite },
                entry.is_favorite ? 'Removed from favorites' : 'Added to favorites',
              )
            }
          >
            <Heart className={cn('h-4 w-4', entry.is_favorite && 'fill-current')} />
          </IconButton>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ImageIcon className="h-4 w-4" />}
            onClick={() => setArtworkModalState({ open: true, tab: 'cover' })}
          >
            Customize Artwork
          </Button>
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            Remove
          </Button>
        </div>
      </div>

      {/* Atmospheric Detail Hero Header */}
      <section className="relative overflow-hidden rounded-2xl border border-outline/70 bg-secondary-background shadow-modal">
        <div className="relative h-[300px] sm:h-[340px] w-full overflow-hidden">
          {resolvedHeroSrc ? (
            <img
              src={resolvedHeroSrc}
              alt={`${entry.game.title} backdrop`}
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  'radial-gradient(circle at 75% 25%, rgba(var(--accent-active-rgb), 0.24), transparent 58%), linear-gradient(135deg, #1A1F26 0%, #0C0F12 100%)',
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 checkpoint-hero-scrim-x" />
          <div className="pointer-events-none absolute inset-0 checkpoint-hero-scrim-y" />
        </div>

        {/* Overlapping Poster + Core Header */}
        <div className="relative z-10 -mt-32 px-6 pb-6 sm:px-9 sm:pb-8 flex flex-col md:flex-row items-start md:items-end gap-6">
          <div className="w-36 sm:w-44 shrink-0 overflow-hidden rounded-xl border-2 border-outline shadow-modal bg-secondary-background">
            <GameArtwork src={coverUrl} alt={entry.game.title} aspect="portrait" className="w-full" />
          </div>

          <div className="min-w-0 flex-1 space-y-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <PlayingStatusBadge status={entry.playing_status} />
              <OwnershipStatusBadge ownership={entry.ownership_status} />
              <PriorityBadge priority={entry.priority} size="md" />
              {entry.game.franchise && (
                <Badge tone="neutral" size="sm">
                  {entry.game.franchise.name}
                </Badge>
              )}
            </div>

            <GameLogo logoUrl={entry.artwork?.logo_url} title={entry.game.title} size="lg" />

            <div className="flex flex-wrap items-center gap-3 text-body-sm text-muted">
              <Badge tone="neutral" size="sm">
                {entry.platform}
              </Badge>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatReleaseYear(entry.game.release_date)}
              </span>
              {entry.game.developer && (
                <>
                  <span>·</span>
                  <span className="text-on-surface">{entry.game.developer}</span>
                </>
              )}
              {igdbRatingText && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-accent-gold font-semibold tabular-nums">
                    <Star className="h-3.5 w-3.5 fill-accent-gold" />
                    {igdbRatingText} IGDB
                    {entry.game.igdb_rating_count ? ` (${entry.game.igdb_rating_count})` : ''}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="accent"
                leftIcon={<Play className="h-4 w-4" />}
                onClick={() => setLaunchModalOpen(true)}
                data-nav-item="true"
              >
                Play Game
              </Button>
              <Button
                variant="secondary"
                leftIcon={<SlidersHorizontal className="h-4 w-4" />}
                onClick={() => setProgressModalOpen(true)}
              >
                Update Progress ({Math.round(entry.progress_pct)}%)
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Clock className="h-4 w-4 text-accent-primary" />}
                onClick={() => setStartSessionOpen(true)}
              >
                Start Play Timer
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Sparkles className="h-4 w-4" />}
                onClick={() => setArtworkModalState({ open: true, tab: 'hero' })}
              >
                Select Hero / Logo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Split: Your Journey Sidebar + 6-Tab Content */}
      <div className="grid gap-6 lg:grid-cols-[310px_1fr] items-start">
        <YourJourneySidebar
          key={`${entry.id}-${entry.updated_at}`}
          entry={entry}
          isSaving={updateMutation.isPending}
          onSavePatch={handlePatch}
        />

        <div className="min-w-0 space-y-5">
          <Tabs
            items={tabs}
            activeId={activeTab}
            onChange={setActiveTab}
            ariaLabel="Game Detail Sections"
          />

          {activeTab === 'overview' && (
            <div className="space-y-5">
              <section className="rounded-2xl border border-outline/75 bg-secondary-background/80 p-6 space-y-4">
                <h3 className="font-headline text-headline-md text-on-background">Synopsis</h3>
                <p className="text-body-md text-on-surface/90 leading-relaxed whitespace-pre-line">
                  {entry.game.summary || 'No synopsis provided by IGDB for this title.'}
                </p>
                {entry.game.storyline && (
                  <div className="pt-3 border-t border-outline/60 space-y-2">
                    <h4 className="font-headline text-headline-sm text-on-background">Storyline</h4>
                    <p className="text-body-sm text-muted leading-relaxed whitespace-pre-line">
                      {entry.game.storyline}
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-outline/75 bg-secondary-background/80 p-6 space-y-4">
                <h3 className="font-headline text-headline-md text-on-background">
                  Metadata & Releases
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-body-sm">
                  <div>
                    <span className="text-muted block text-[11px] uppercase">Developer</span>
                    <span className="text-on-surface font-medium">
                      {entry.game.developer || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px] uppercase">Publisher</span>
                    <span className="text-on-surface font-medium">
                      {entry.game.publisher || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px] uppercase">Release Date</span>
                    <span className="text-on-surface font-medium">
                      {formatShortDate(entry.game.release_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px] uppercase">IGDB ID</span>
                    <span className="text-on-surface font-medium tabular-nums">
                      #{entry.game.igdb_id}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px] uppercase">Steam App ID</span>
                    <span className="text-on-surface font-medium tabular-nums">
                      {entry.game.steam_app_id ? `#${entry.game.steam_app_id}` : 'Not linked'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px] uppercase">Franchise</span>
                    <span className="text-on-surface font-medium">
                      {entry.game.franchise?.name ?? 'Standalone'}
                    </span>
                  </div>
                </div>

                {entry.game.genres.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <span className="text-muted text-[11px] uppercase block">Genres</span>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.game.genres.map((g) => (
                        <Badge key={g.id} tone="neutral" size="sm">
                          {g.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {entry.game.platforms.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <span className="text-muted text-[11px] uppercase block">IGDB Platforms</span>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.game.platforms.map((p) => (
                        <Badge key={p} tone="outline" size="sm">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {customTagList.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <span className="text-muted text-[11px] uppercase block">Your Custom Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                      {customTagList.map((tag) => (
                        <Badge key={tag} tone="accent" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'progress' && (
            <section className="rounded-2xl border border-outline/75 bg-secondary-background/80 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-headline text-headline-md text-on-background">
                  Completion Progress & Milestones
                </h3>
                <Button
                  variant="accent"
                  size="sm"
                  leftIcon={<SlidersHorizontal className="h-4 w-4" />}
                  onClick={() => setProgressModalOpen(true)}
                >
                  Adjust Progress
                </Button>
              </div>

              <div className="rounded-xl border border-outline/70 bg-surface/55 p-5 space-y-3">
                <ProgressBar
                  value={entry.progress_pct}
                  label={
                    entry.progress_pct === 0
                      ? 'Unrecorded / Not Started'
                      : `Target: ${entry.completion_goal}`
                  }
                  showPercentage
                  height="md"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3 text-body-sm">
                <div className="rounded-xl border border-outline/70 bg-surface/45 p-4">
                  <span className="text-muted block">Personal Rating</span>
                  <span className="font-headline text-headline-md text-on-background tabular-nums mt-1 block">
                    {formatPersonalRating(entry.personal_rating)}
                  </span>
                </div>
                <div className="rounded-xl border border-outline/70 bg-surface/45 p-4">
                  <span className="text-muted block">Logged Playtime</span>
                  <span className="font-headline text-headline-md text-on-background tabular-nums mt-1 block">
                    {formatHoursLogged(entry.hours_played)}
                  </span>
                </div>
                <div className="rounded-xl border border-outline/70 bg-surface/45 p-4">
                  <span className="text-muted block">Target Window</span>
                  <span className="font-headline text-headline-sm text-on-background mt-1 block">
                    {entry.target_completion_date
                      ? formatShortDate(entry.target_completion_date)
                      : 'No target set'}
                  </span>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'notes' && (
            <NotesTabEditor
              key={`${entry.id}-${entry.updated_at}`}
              entry={entry}
              isSaving={updateMutation.isPending}
              onSaveNotes={(notesText) =>
                handlePatch({ notes: notesText }, 'Playthrough notes saved')
              }
            />
          )}

          {activeTab === 'screenshots' && (
            <section className="rounded-2xl border border-outline/75 bg-secondary-background/80 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-headline-md text-on-background">
                  Media & Screenshots
                </h3>
                <Badge tone="neutral" size="sm" className="tabular-nums">
                  {screenshots.length}
                </Badge>
              </div>

              {screenshots.length === 0 ? (
                <EmptyState
                  compact
                  icon={<ImageIcon className="h-6 w-6" />}
                  title="No Screenshots Imported"
                  description="IGDB did not attach screenshots for this title. You can still customize portrait covers, heroes, and transparent logos via SteamGridDB."
                  actions={
                    <Button
                      variant="secondary"
                      onClick={() => setArtworkModalState({ open: true, tab: 'hero' })}
                    >
                      Open Artwork Selector
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {screenshots.map((shot, idx) => (
                    <button
                      key={shot.id}
                      type="button"
                      data-nav-item="true"
                      onClick={() => setLightboxIdx(idx)}
                      className="group overflow-hidden rounded-xl border border-outline/70 hover:border-accent-active transition-all"
                    >
                      <GameArtwork
                        src={shot.cached_url ?? shot.remote_url}
                        alt={`${entry.game.title} screenshot ${idx + 1}`}
                        aspect="landscape"
                        className="w-full"
                        imgClassName="transition-transform duration-300 group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'sessions' && (
            <EmptyState
              icon={<Clock className="h-7 w-7" />}
              title="Play Session Logging Arrives in Phase 5"
              description={`Manual session duration logging, timestamps, and per-session diaries require the Phase 5 session ledger API. ${
                entry.hours_played > 0
                  ? `Recorded total hours: ${formatHoursLogged(entry.hours_played)}.`
                  : 'No session durations are recorded for this game yet.'
              }`}
              actions={
                <Button
                  variant="secondary"
                  leftIcon={<Gamepad2 className="h-4 w-4" />}
                  onClick={() => setProgressModalOpen(true)}
                >
                  Update Progress Instead
                </Button>
              }
            />
          )}

          {activeTab === 'achievements' && (
            <GameAchievementsTab
              gameId={entry.game_id}
              gameTitle={entry.game.title}
              steamAppId={entry.game.steam_app_id}
              onSuggestCompletion={() =>
                handlePatch(
                  { playing_status: '100% Completed', progress_pct: 100 },
                  'Marked as 100% Completed based on Steam achievements!',
                )
              }
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <UpdateProgressModal
        entry={entry}
        isOpen={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
      />

      <ArtworkSelectorModal
        entry={entry}
        isOpen={artworkModalState.open}
        initialTab={artworkModalState.tab}
        onClose={() => setArtworkModalState((s) => ({ ...s, open: false }))}
      />

      {/* Delete Confirmation */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Remove from Library?"
        subtitle={entry.game.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={removeMutation.isPending}
              onClick={() => void handleRemove()}
            >
              Remove Game
            </Button>
          </>
        }
      >
        <p className="text-body-md text-muted leading-relaxed">
          Remove <span className="text-on-background font-semibold">{entry.game.title}</span> from
          your personal library? Notes, ratings, and status history for this entry will be removed.
        </p>
      </Modal>

      {/* Screenshot Lightbox */}
      <Modal
        isOpen={lightboxIdx !== null && Boolean(screenshots[lightboxIdx])}
        onClose={() => setLightboxIdx(null)}
        title={
          lightboxIdx !== null
            ? `${entry.game.title} — Screenshot ${lightboxIdx + 1} / ${screenshots.length}`
            : undefined
        }
        size="xl"
      >
        {lightboxIdx !== null && screenshots[lightboxIdx] && (
          <div className="space-y-4">
            <GameArtwork
              src={screenshots[lightboxIdx].cached_url ?? screenshots[lightboxIdx].remote_url}
              alt={`${entry.game.title} screenshot ${lightboxIdx + 1}`}
              aspect="landscape"
              className="w-full rounded-xl"
              eager
            />
            {screenshots.length > 1 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                  onClick={() =>
                    setLightboxIdx(
                      (lightboxIdx - 1 + screenshots.length) % screenshots.length,
                    )
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                  onClick={() => setLightboxIdx((lightboxIdx + 1) % screenshots.length)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {entry && (
        <>
          <StartSessionModal
            isOpen={startSessionOpen}
            onClose={() => setStartSessionOpen(false)}
            preselectedEntryId={entry.id}
          />
          <LaunchConfigModal
            open={launchModalOpen}
            onClose={() => setLaunchModalOpen(false)}
            gameId={entry.game_id}
            gameTitle={entry.game.title}
          />
        </>
      )}
    </div>
  );
}
