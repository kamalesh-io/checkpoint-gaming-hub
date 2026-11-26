import { useState, type FormEvent } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCompletePlannerSessionMutation } from '@/hooks/queries';
import { useToastStore } from '@/stores/toastStore';
import type { ScheduledSessionRead } from '@/types';

interface CompleteSessionModalProps {
  session: ScheduledSessionRead | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CompleteSessionModal({
  session,
  isOpen,
  onClose,
}: CompleteSessionModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const completeMutation = useCompletePlannerSessionMutation();

  const [actualDuration, setActualDuration] = useState<number>(
    session?.duration_minutes ?? 60,
  );
  const [logAsPlaySession, setLogAsPlaySession] = useState<boolean>(true);
  const [completionNotes, setCompletionNotes] = useState<string>('');

  if (!isOpen || !session) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await completeMutation.mutateAsync({
        id: session.id,
        payload: {
          actual_duration_minutes: actualDuration > 0 ? actualDuration : null,
          log_as_play_session: logAsPlaySession,
          notes: completionNotes.trim() || null,
        },
      });

      addToast({
        tone: 'success',
        title: 'Session Completed!',
        message: logAsPlaySession
          ? `Logged ${actualDuration}m of playtime to "${session.library_entry?.game.title}".`
          : 'Session marked as completed.',
      });
      onClose();
    } catch {
      addToast({
        tone: 'error',
        title: 'Completion Failed',
        message: 'Could not complete scheduled session.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-outline/80 bg-surface-darker p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-outline/70 pb-3">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <h3 className="font-headline text-headline-sm font-bold text-on-background">
              Complete Session
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

        <p className="mt-3 text-body-sm text-on-surface-variant">
          Great job! Finalize details for{' '}
          <strong className="text-on-background">
            {session.library_entry?.game.title ?? 'your session'}
          </strong>
          .
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Actual Duration Played (minutes)
            </label>
            <input
              data-nav-item="true"
              type="number"
              min="1"
              max="1440"
              value={actualDuration}
              onChange={(e) => setActualDuration(Number(e.target.value))}
              required
              className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-body-sm text-on-background">
            <input
              data-nav-item="true"
              type="checkbox"
              checked={logAsPlaySession}
              onChange={(e) => setLogAsPlaySession(e.target.checked)}
              className="rounded border-outline/70 bg-surface-dark text-accent-primary focus:ring-accent-primary"
            />
            <span>Log as playtime & record in session history</span>
          </label>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Reflections / Notes (optional)
            </label>
            <textarea
              data-nav-item="true"
              rows={2}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="What did you accomplish?"
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
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? 'Saving...' : 'Finish Session'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
