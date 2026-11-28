import { useEffect, useRef } from 'react';
import { ArrowUpCircle, CheckCircle2, Download, ExternalLink, RefreshCw, Sparkles, X, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { soundManager } from '@/audio/soundManager';
import { SoundEvent } from '@/audio/soundEvents';
import checkpointEmblem from '@/assets/Checkpoint Gaming Emblem.png';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function UpdateDialog() {
  const {
    dialogOpen,
    closeDialog,
    status,
    currentVersion,
    availableVersion,
    releaseDate,
    releaseNotes,
    downloadSize,
    downloadedBytes,
    downloadSpeed,
    progressPct,
    errorMessage,
    downloadAndInstall,
    skipVersion,
  } = useAppUpdater();

  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dialogOpen) {
      soundManager.play(SoundEvent.SELECT);
      setTimeout(() => primaryBtnRef.current?.focus(), 80);
    }
  }, [dialogOpen]);

  if (!dialogOpen) return null;

  const isDownloading = status === 'downloading';
  const isVerifying = status === 'verifying';
  const isInstalling = status === 'installing';
  const isBusy = isDownloading || isVerifying || isInstalling;

  const handleAction = async () => {
    soundManager.play(SoundEvent.CLICK);
    await downloadAndInstall();
  };

  const handleSkip = () => {
    if (availableVersion) {
      soundManager.play(SoundEvent.CLICK);
      skipVersion(availableVersion);
    }
  };

  const formattedDate = releaseDate
    ? new Date(releaseDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Modal
      isOpen={dialogOpen}
      onClose={() => !isBusy && closeDialog()}
      title=""
      size="lg"
      className="!max-w-2xl !bg-[#14181D]/95 !border-white/[0.08] backdrop-blur-2xl shadow-2xl p-0 overflow-hidden"
    >
      {/* Header Banner */}
      <div className="relative p-6 pb-5 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <img
              src={checkpointEmblem}
              alt="CHECKPOINT"
              className="w-12 h-12 object-contain drop-shadow-[0_0_16px_rgba(255,255,255,0.15)]"
            />
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                  Software Update Available
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <Sparkles className="w-3 h-3" />
                  Official Release
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                <span>Current: v{currentVersion}</span>
                <span>•</span>
                <span className="text-amber-400 font-medium">New: v{availableVersion || '1.1.0'}</span>
                {formattedDate && (
                  <>
                    <span>•</span>
                    <span>{formattedDate}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {!isBusy && (
            <button
              onClick={() => {
                soundManager.play(SoundEvent.CLICK);
                closeDialog();
              }}
              data-nav-item="true"
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6 space-y-5">
        {/* Release Notes Card */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-white/60">
            <span>Release Notes</span>
            <a
              href={`https://github.com/kamalesh-io/checkpoint-gaming-hub/releases/tag/v${availableVersion || '1.1.0'}`}
              target="_blank"
              rel="noopener noreferrer"
              data-nav-item="true"
              className="inline-flex items-center gap-1 text-white/40 hover:text-amber-400 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 rounded px-1"
            >
              <span>View on GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl p-4 bg-[#0C0F12]/80 border border-white/[0.05] text-sm text-white/80 leading-relaxed space-y-2 font-['DM_Sans',sans-serif]">
            {releaseNotes ? (
              <div className="whitespace-pre-line text-xs sm:text-sm text-white/70">
                {releaseNotes}
              </div>
            ) : (
              <div className="space-y-2 text-xs sm:text-sm text-white/70">
                <p className="font-semibold text-white">CHECKPOINT Gaming Hub v{availableVersion || '1.1.0'} — Cinematic Update</p>
                <ul className="list-disc list-inside space-y-1 text-white/60">
                  <li>Cinematic UI V3 with Floating Navigation Dock and dynamic artwork themes.</li>
                  <li>Procedural Web Audio sound system for interactive tactile feedback.</li>
                  <li>Full Steam Family Sharing library detection and attribution.</li>
                  <li>Automated signed updates via GitHub Releases distribution.</li>
                  <li>Resolved BUG-001 through BUG-020 stability improvements.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Download & Installation Progress */}
        {isBusy && (
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-white/70 flex items-center gap-2">
                {isDownloading && (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    Downloading Update...
                  </>
                )}
                {isVerifying && (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    Verifying Cryptographic Signature...
                  </>
                )}
                {isInstalling && (
                  <>
                    <ArrowUpCircle className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                    Preparing Safe Migration & Installing...
                  </>
                )}
              </span>
              <span className="text-white/50 font-mono">
                {downloadSize ? `${formatBytes(downloadedBytes)} / ${formatBytes(downloadSize)}` : formatBytes(downloadedBytes)}
                {downloadSpeed > 0 && ` • ${(downloadSpeed / (1024 * 1024)).toFixed(1)} MB/s`}
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isInstalling
                    ? 'bg-emerald-500 animate-pulse'
                    : isVerifying
                    ? 'bg-cyan-500'
                    : 'bg-gradient-to-r from-amber-500 to-amber-300'
                }`}
                style={{ width: `${Math.max(5, progressPct)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message banner */}
        {status === 'error' && errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-semibold text-red-200">Update Error</p>
              <p className="text-red-300/80">{errorMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 px-6 border-t border-white/[0.06] bg-[#0C0F12]/60 flex items-center justify-between">
        <div>
          {!isBusy && (
            <button
              onClick={handleSkip}
              data-nav-item="true"
              className="text-xs text-white/40 hover:text-white/70 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 rounded px-1.5 py-1"
            >
              Skip this version
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isBusy && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                soundManager.play(SoundEvent.CLICK);
                closeDialog();
              }}
              data-nav-item="true"
              className="rounded-full !px-5 text-white/70 border-white/[0.12] hover:bg-white/[0.06]"
            >
              Remind Me Later
            </Button>
          )}

          <Button
            ref={primaryBtnRef}
            variant="primary"
            size="sm"
            onClick={handleAction}
            disabled={isBusy}
            data-nav-item="true"
            className="rounded-full !px-6 !bg-white hover:!bg-white/90 !text-[#101114] font-semibold flex items-center gap-2 shadow-lg shadow-white/10"
          >
            {isDownloading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#101114]" />
                Downloading ({progressPct}%)
              </>
            ) : isVerifying ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#101114]" />
                Verifying...
              </>
            ) : isInstalling ? (
              <>
                <ArrowUpCircle className="w-4 h-4 animate-spin text-[#101114]" />
                Installing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-[#101114]" />
                Download & Install
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
