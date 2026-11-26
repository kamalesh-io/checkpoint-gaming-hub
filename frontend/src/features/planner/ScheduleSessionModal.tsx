import { useState, type FormEvent } from 'react';
import { AlertTriangle, Calendar, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCreatePlannerSessionMutation, useLibraryQuery } from '@/hooks/queries';
import { useToastStore } from '@/stores/toastStore';

interface ScheduleSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedEntryId?: string;
}

export function ScheduleSessionModal({
  isOpen,
  onClose,
  preselectedEntryId,
}: ScheduleSessionModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const { data: libraryData } = useLibraryQuery({ limit: 100 });
  const createMutation = useCreatePlannerSessionMutation();

  const [entryId, setEntryId] = useState<string>(preselectedEntryId ?? '');
  const [scheduledStart, setScheduledStart] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm format for datetime-local
  });
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [reminderMinutes, setReminderMinutes] = useState<number>(15);
  const [repeatSchedule, setRepeatSchedule] = useState<string>('None');
  const [notes, setNotes] = useState<string>('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  const libraryEntries = libraryData?.data ?? [];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setConflictWarning(null);

    if (!entryId) {
      addToast({
        tone: 'error',
        title: 'Game Required',
        message: 'Please choose a game from your library to schedule.',
      });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        library_entry_id: entryId,
        scheduled_start: new Date(scheduledStart).toISOString(),
        duration_minutes: Number(durationMinutes),
        reminder_minutes_before: reminderMinutes > 0 ? Number(reminderMinutes) : null,
        repeat_schedule: repeatSchedule,
        notes: notes.trim() || null,
      });

      if (result.conflict_warning) {
        setConflictWarning(result.conflict_warning);
        addToast({
          tone: 'warning',
          title: 'Schedule Conflict Warning',
          message: result.conflict_warning,
        });
      } else {
        addToast({
          tone: 'success',
          title: 'Session Scheduled',
          message: 'Gaming session added to your calendar.',
        });
        onClose();
      }
    } catch {
      addToast({
        tone: 'error',
        title: 'Scheduling Failed',
        message: 'Could not create scheduled session in SQLite.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl border border-outline/80 bg-surface-darker p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline/70 pb-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-5 w-5 text-accent-primary" />
            <h2 className="font-headline text-headline-md font-bold text-on-background">
              Schedule Gaming Session
            </h2>
          </div>
          <button
            data-nav-item="true"
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {conflictWarning && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning/50 bg-warning/10 p-3 text-body-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Schedule Overlap Alert</p>
              <p className="mt-0.5 text-caption opacity-90">{conflictWarning}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Game Selection */}
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
                  {e.game.title} ({e.playing_status})
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                Date & Time
              </label>
              <input
                data-nav-item="true"
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                required
                className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>

            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                Duration (minutes)
              </label>
              <input
                data-nav-item="true"
                type="number"
                min="15"
                max="720"
                step="15"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                required
                className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>
          </div>

          {/* Repeat Schedule & Reminder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                Repeat Schedule
              </label>
              <select
                data-nav-item="true"
                value={repeatSchedule}
                onChange={(e) => setRepeatSchedule(e.target.value)}
                className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
              >
                <option value="None">Does not repeat</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Weekends">Weekends only</option>
              </select>
            </div>

            <div>
              <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
                Reminder Notice
              </label>
              <select
                data-nav-item="true"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
              >
                <option value={0}>No reminder</option>
                <option value={5}>5 minutes before</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={60}>1 hour before</option>
              </select>
            </div>
          </div>

          {/* Reminder Notice Lifecycle Disclaimer */}
          <div className="flex items-start gap-2 rounded-xl bg-surface-dark/80 p-3 text-caption text-on-surface-variant border border-outline/50">
            <Info className="h-4 w-4 shrink-0 text-accent-primary mt-0.5" />
            <span>
              Note: Because CHECKPOINT is a local desktop application without background cloud
              daemons, reminder notifications fire while the app is active or minimized.
            </span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Session Goal / Notes (optional)
            </label>
            <textarea
              data-nav-item="true"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Complete Chapter 4, defeat Malenia, or grind side quests"
              className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline/60">
            <Button data-nav-item="true" variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              data-nav-item="true"
              variant="primary"
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Scheduling...' : 'Save Session'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
