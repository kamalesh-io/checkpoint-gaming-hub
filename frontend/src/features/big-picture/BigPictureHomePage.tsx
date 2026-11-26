import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Image as ImageIcon, Play, Plus, SlidersHorizontal } from 'lucide-react';
import { GameArtwork } from '@/components/game/GameArtwork';
import { GameLogo } from '@/components/game/GameLogo';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { HeroSkeleton, LandscapeCardSkeleton } from '@/components/ui/Skeleton';
import { ArtworkSelectorModal } from '@/features/modals/ArtworkSelectorModal';
import { UpdateProgressModal } from '@/features/modals/UpdateProgressModal';
import { useLibraryQuery } from '@/hooks/queries';
import { CONTROLLER_CUSTOM_EVENT } from '@/hooks/useSpatialNavigation';
import { ROUTES } from '@/routes/routes';
import type { ControllerActionEvent } from '@/services/gamepad/types';
import { useAppStore } from '@/stores/appStore';
import { useControllerStore } from '@/stores/controllerStore';
import type { LibraryEntryRead } from '@/types';
import { cn } from '@/utils/cn';

/**
 * Fullscreen Console Home View (Stitch node_11731173976490379291):
 * Lower-third dynamic spotlight, logo/title, honest completion status,
 * 4-card 16:9 horizontal console carousel with accent ring & scale highlight.
 */
export function BigPictureHomePage() {
  const navigate = useNavigate();
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const activeEntryId = useControllerStore((s) => s.bigPictureActiveEntryId);
  const setActiveEntryId = useControllerStore((s) => s.setBigPictureActiveEntryId);

  const libraryQuery = useLibraryQuery({ limit: 100, sort: 'recently_played' });
  const entries = useMemo(() => libraryQuery.data?.data ?? [], [libraryQuery.data]);

  const carouselEntries = useMemo(() => {
    if (entries.length === 0) return [];
    const playing = entries.filter((e) => e.playing_status === 'Currently Playing');
    const rest = entries.filter((e) => e.playing_status !== 'Currently Playing');
    return [...playing, ...rest].slice(0, 16);
  }, [entries]);

  const activeEntry = useMemo(() => {
    if (carouselEntries.length === 0) return null;
    if (activeEntryId) {
      const hit = carouselEntries.find((e) => e.id === activeEntryId);
      if (hit) return hit;
    }
    return carouselEntries[0] ?? null;
  }, [carouselEntries, activeEntryId]);

  const [progressTarget, setProgressTarget] = useState<LibraryEntryRead | null>(null);
  const [artworkTarget, setArtworkTarget] = useState<LibraryEntryRead | null>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Automatically center-scroll active carousel tile
  useEffect(() => {
    if (!activeEntry) return;
    const el = cardRefs.current.get(activeEntry.id);
    el?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [activeEntry, reducedMotion]);

  // Listen for X (Update Progress) / Menu context actions on the active spotlight game
  useEffect(() => {
    const onController = (ev: Event) => {
      const detail = (ev as CustomEvent<ControllerActionEvent>).detail;
      if (!detail || !activeEntry || document.querySelector('[aria-modal="true"]')) return;

      if (detail.action === 'QUICK_ACTION') {
        ev.preventDefault();
        setProgressTarget(activeEntry);
      }
    };
    window.addEventListener(CONTROLLER_CUSTOM_EVENT, onController);
    return () => window.removeEventListener(CONTROLLER_CUSTOM_EVENT, onController);
  }, [activeEntry]);

  if (libraryQuery.isLoading) {
    return (
      <div className="flex h-full flex-col justify-end gap-8 pb-4">
        <HeroSkeleton />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <LandscapeCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-8">
        <EmptyState
          icon={<Compass className="h-9 w-9" />}
          title="Welcome to CHECKPOINT Big Picture"
          description="Your personal living-room hub has no imported games yet. Search IGDB with the controller keyboard to add your first game."
          actions={
            <Button
              variant="accent"
              size="lg"
              data-nav-primary="true"
              leftIcon={<Plus className="h-5 w-5" />}
              onClick={() => navigate(`${ROUTES.BIG_PICTURE}/discover`)}
            >
              Discover Games on IGDB
            </Button>
          }
        />
      </div>
    );
  }

  if (!activeEntry) return null;

  const statusPillText =
    activeEntry.progress_pct > 0
      ? `${activeEntry.playing_status} • ${Math.round(activeEntry.progress_pct)}% Complete`
      : `${activeEntry.playing_status} • ${activeEntry.ownership_status}`;

  return (
    <div className="flex min-h-full flex-col justify-end gap-8 pb-3">
      {/* Lower-Third Spotlight Content */}
      <section className="max-w-3xl space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent-active/40 bg-surface-elevated/90 px-4 py-1.5 font-label text-label-md text-accent-active shadow-card">
          {statusPillText}
        </span>

        <div>
          <GameLogo
            logoUrl={activeEntry.artwork?.logo_url}
            title={activeEntry.game.title}
            size="lg"
          />
        </div>

        <p className="line-clamp-2 font-body text-body-lg text-on-surface/85 max-w-prose leading-relaxed">
          {activeEntry.game.summary ||
            `${activeEntry.game.developer ?? 'Personal Collection'} · ${activeEntry.platform}`}
        </p>

        {activeEntry.progress_pct > 0 && (
          <div className="max-w-md pt-0.5">
            <ProgressBar
              value={activeEntry.progress_pct}
              label={`Goal: ${activeEntry.completion_goal}`}
              showPercentage
              height="sm"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3.5 pt-2" data-nav-group="bp-actions">
          <Button
            variant="accent"
            size="lg"
            data-nav-primary="true"
            data-nav-group="bp-actions"
            leftIcon={<Play className="h-5 w-5 fill-current" />}
            onClick={() => navigate(`${ROUTES.BIG_PICTURE}/games/${activeEntry.id}`)}
          >
            Open Game
          </Button>
          <Button
            variant="secondary"
            size="lg"
            data-nav-group="bp-actions"
            leftIcon={<SlidersHorizontal className="h-4 w-4" />}
            onClick={() => setProgressTarget(activeEntry)}
          >
            Update Progress
          </Button>
          <Button
            variant="ghost"
            size="lg"
            data-nav-group="bp-actions"
            leftIcon={<ImageIcon className="h-4 w-4" />}
            onClick={() => setArtworkTarget(activeEntry)}
          >
            Customize Art
          </Button>
        </div>
      </section>

      {/* Large 4-Card Horizontal 16:9 Console Carousel */}
      <section aria-label="Game Selection Carousel" className="space-y-3">
        <div
          data-nav-group="bp-carousel"
          className="flex gap-5 overflow-x-auto no-scrollbar py-2 px-1"
        >
          {carouselEntries.map((entry) => {
            const isSelected = entry.id === activeEntry.id;
            const thumbSrc =
              entry.artwork?.hero_url ??
              entry.artwork?.cover_url ??
              entry.game.artworks.find((a) => a.asset_type === 'hero')?.remote_url ??
              null;

            return (
              <button
                key={entry.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(entry.id, el);
                  else cardRefs.current.delete(entry.id);
                }}
                type="button"
                data-nav-item="true"
                data-nav-group="bp-carousel"
                data-nav-id={`bp-tile-${entry.id}`}
                aria-pressed={isSelected}
                onFocus={() => setActiveEntryId(entry.id)}
                onClick={() => {
                  if (isSelected) {
                    navigate(`${ROUTES.BIG_PICTURE}/games/${entry.id}`);
                  } else {
                    setActiveEntryId(entry.id);
                  }
                }}
                onDoubleClick={() => navigate(`${ROUTES.BIG_PICTURE}/games/${entry.id}`)}
                className={cn(
                  'group relative shrink-0 w-[calc(50%-10px)] sm:w-[calc(25%-15px)] min-w-[240px] rounded-xl overflow-hidden text-left checkpoint-nav-card',
                  'transition-all duration-card-hover ease-card-hover',
                  isSelected
                    ? 'ring-4 ring-accent-active shadow-2xl scale-[1.04] opacity-100 z-10'
                    : 'border border-outline/60 opacity-80 hover:opacity-100 hover:scale-[1.03]',
                )}
              >
                <div className="relative aspect-video w-full">
                  <GameArtwork
                    src={thumbSrc}
                    fallbackSrc={entry.artwork?.cover_url}
                    alt={entry.game.title}
                    aspect="landscape"
                    className="h-full w-full"
                    imgClassName={cn(isSelected && 'brightness-110')}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/25 to-transparent flex flex-col justify-end p-4">
                    <span className="font-headline text-headline-sm text-on-background truncate">
                      {entry.game.title}
                    </span>
                    <span className="text-[12px] text-muted truncate">
                      {entry.progress_pct > 0
                        ? `${Math.round(entry.progress_pct)}% · ${entry.platform}`
                        : entry.platform}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <UpdateProgressModal
        entry={progressTarget}
        isOpen={Boolean(progressTarget)}
        onClose={() => setProgressTarget(null)}
      />

      <ArtworkSelectorModal
        entry={artworkTarget}
        isOpen={Boolean(artworkTarget)}
        initialTab="hero"
        onClose={() => setArtworkTarget(null)}
      />
    </div>
  );
}
