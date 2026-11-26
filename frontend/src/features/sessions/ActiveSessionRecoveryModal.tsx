import { useState } from 'react';
import { AlertTriangle, Clock, Play, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useActiveSessionQuery,
  useDiscardActiveSessionMutation,
  useEndActiveSessionMutation,
  useResumeActiveSessionMutation,
} from '@/hooks/queries';
import { useToastStore } from '@/stores/toastStore';

export function ActiveSessionRecoveryModal() {
  const addToast = useToastStore((s) => s.addToast);
  const { data: activeSession } = useActiveSessionQuery();

  const discardMutation = useDiscardActiveSessionMutation();
  const endMutation = useEndActiveSessionMutation();
  const resumeMutation = useResumeActiveSessionMutation();

  const [dismissed, setDismissed] = useState(false);

  // If there's an active session, display recovery modal once on app mount
  if (!activeSession || dismissed) return null;

  const entry = activeSession.library_entry;
  const elapsedMinutes = Math.round(activeSession.elapsed_seconds / 60);

  const handleResume = async () => {
    try {
      if (activeSession.is_paused) {
        await resumeMutation.mutateAsync();
      }
      setDismissed(true);
      addToast({
        tone: 'accent',
        title: 'Session Resumed',
        message: `Continuing active session for "${entry?.game.title ?? 'Game'}".`,
      });
    } catch {
      setDismissed(true);
    }
  };

  const handleEndAndSave = async () => {
    try {
      await endMutation.mutateAsync();
      setDismissed(true);
      addToast({
        tone: 'success',
        title: 'Session Saved',
        message: `Saved ${elapsedMinutes} minutes of playtime.`,
      });
    } catch {
      setDismissed(true);
    }
  };

  const handleDiscard = async () => {
    try {
      await discardMutation.mutateAsync();
      setDismissed(true);
      addToast({
        tone: 'neutral',
        title: 'Session Discarded',
        message: 'Unsaved session data was discarded.',
      });
    } catch {
      setDismissed(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border-2 border-warning/80 bg-surface-darker p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 text-warning">
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <h3 className="font-headline text-headline-sm font-bold text-on-background">
            Unfinalized Session Detected
          </h3>
        </div>

        <p className="mt-3 text-body-md text-on-surface-variant">
          An active play session was in progress when CHECKPOINT was previously closed or restarted:
        </p>

        <div className="mt-4 rounded-xl border border-outline/70 bg-surface-dark p-4">
          <p className="font-headline text-headline-sm font-bold text-on-background">
            {entry?.game.title ?? 'Unknown Game'}
          </p>
          <div className="mt-1 flex items-center gap-2 text-body-sm text-accent-primary">
            <Clock className="h-4 w-4" />
            <span>Elapsed: ~{elapsedMinutes} minutes</span>
            {activeSession.is_paused && <span className="text-warning">(Paused)</span>}
          </div>
          {activeSession.location_or_chapter && (
            <p className="mt-1 text-caption text-on-surface-variant">
              Chapter/Area: {activeSession.location_or_chapter}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            data-nav-item="true"
            variant="ghost"
            onClick={handleDiscard}
            disabled={discardMutation.isPending}
            className="text-error hover:bg-error/10"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Discard
          </Button>

          <Button
            data-nav-item="true"
            variant="secondary"
            onClick={handleEndAndSave}
            disabled={endMutation.isPending}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            End & Save
          </Button>

          <Button
            data-nav-item="true"
            variant="primary"
            onClick={handleResume}
            disabled={resumeMutation.isPending}
          >
            <Play className="mr-1.5 h-4 w-4" />
            Resume
          </Button>
        </div>
      </div>
    </div>
  );
}
