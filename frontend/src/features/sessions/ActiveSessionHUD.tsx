import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Gamepad2,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import {
  useActiveSessionQuery,
  useEndActiveSessionMutation,
  usePauseActiveSessionMutation,
  useResumeActiveSessionMutation,
} from '@/hooks/queries';
import { buildGameDetailsRoute } from '@/routes/routes';
import { useToastStore } from '@/stores/toastStore';

export function ActiveSessionHUD() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const { data: activeSession } = useActiveSessionQuery();
  const pauseMutation = usePauseActiveSessionMutation();
  const resumeMutation = useResumeActiveSessionMutation();
  const endMutation = useEndActiveSessionMutation();

  const [isMinimized, setIsMinimized] = useState(false);
  const [ticksSinceServer, setTicksSinceServer] = useState(0);

  // Client-side 1s ticker while active session is running and not paused
  useEffect(() => {
    if (!activeSession || activeSession.is_paused) return;

    const interval = setInterval(() => {
      setTicksSinceServer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  if (!activeSession) return null;

  const localSeconds = (activeSession.elapsed_seconds ?? 0) + ticksSinceServer;
  const entry = activeSession.library_entry;
  const coverArtwork = entry?.game.artworks?.find((a) => a.asset_type === 'cover');
  const coverUrl = coverArtwork?.cached_url ?? coverArtwork?.remote_url;

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTogglePause = async () => {
    try {
      if (activeSession.is_paused) {
        await resumeMutation.mutateAsync();
        addToast({ tone: 'accent', title: 'Timer Resumed', message: 'Session timer is running.' });
      } else {
        await pauseMutation.mutateAsync();
        addToast({ tone: 'neutral', title: 'Timer Paused', message: 'Session paused.' });
      }
    } catch {
      addToast({ tone: 'error', title: 'Action Failed', message: 'Could not toggle session pause.' });
    }
  };

  const handleEndSession = async () => {
    try {
      const minutes = Math.max(1, Math.round(localSeconds / 60));
      await endMutation.mutateAsync();
      addToast({
        tone: 'success',
        title: 'Session Ended & Saved',
        message: `Logged ${minutes} minute(s) of playtime to "${entry?.game.title ?? 'Game'}".`,
      });
    } catch {
      addToast({ tone: 'error', title: 'Failed to End Session', message: 'Could not finalize session.' });
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <div className="flex items-center gap-3 rounded-2xl border-2 border-accent-primary bg-surface-darker/95 p-3.5 shadow-2xl backdrop-blur-md">
        {/* Cover thumbnail */}
        <div
          className="h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-surface-dark cursor-pointer shadow-sm"
          onClick={() => entry && navigate(buildGameDetailsRoute(entry.id))}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
              <Gamepad2 className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* Info & Timer */}
        {!isMinimized && (
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <span className="font-headline text-body-md font-bold text-on-background truncate max-w-[180px]">
                {entry?.game.title ?? 'Active Session'}
              </span>
              <span className="flex h-2 w-2 rounded-full bg-accent-primary animate-ping" />
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-headline-sm font-bold text-accent-primary tabular-nums">
                {formatTimer(localSeconds)}
              </span>
              {activeSession.is_paused && (
                <Badge tone="warning" size="sm">
                  PAUSED
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-1.5 border-l border-outline/60 pl-2">
          {/* Pause / Resume */}
          <button
            data-nav-item="true"
            onClick={handleTogglePause}
            title={activeSession.is_paused ? 'Resume Session' : 'Pause Session'}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background transition-colors"
          >
            {activeSession.is_paused ? (
              <Play className="h-4 w-4 text-accent-primary" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </button>

          {/* End Session */}
          <button
            data-nav-item="true"
            onClick={handleEndSession}
            title="End and Save Session"
            className="rounded-lg p-2 text-error hover:bg-error/15 transition-colors"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>

          {/* Minimize toggle */}
          <button
            data-nav-item="true"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated"
          >
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
