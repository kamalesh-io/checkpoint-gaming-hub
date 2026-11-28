import { useState } from 'react';
import { ArrowUpCircle, CheckCircle2, Clock, ExternalLink, HelpCircle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { soundManager } from '@/audio/soundManager';
import { SoundEvent } from '@/audio/soundEvents';
import checkpointEmblem from '@/assets/Checkpoint Gaming Emblem.png';

export function UpdateSettingsSection() {
  const {
    currentVersion,
    availableVersion,
    status,
    lastChecked,
    preferences,
    hasUpdate,
    checkForUpdates,
    openDialog,
    openWhatsNew,
    updatePreferences,
  } = useAppUpdater();

  const [isManualChecking, setIsManualChecking] = useState(false);

  const handleManualCheck = async () => {
    soundManager.play(SoundEvent.CLICK);
    setIsManualChecking(true);
    await checkForUpdates(true);
    setIsManualChecking(false);
  };

  const formattedLastChecked = lastChecked
    ? new Date(lastChecked).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Never';

  return (
    <div className="space-y-8 font-['DM_Sans',sans-serif]">
      {/* 1. Application Information Header */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={checkpointEmblem}
            alt="CHECKPOINT"
            className="w-16 h-16 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h3 className="text-xl font-bold text-white font-['Plus_Jakarta_Sans',sans-serif]">
                CHECKPOINT Gaming Hub
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                Stable Channel
              </span>
            </div>
            <p className="text-xs text-white/50">
              Installed Version: <span className="font-mono text-white/80 font-medium">v{currentVersion}</span>
              {' • '}
              Distribution: <span className="text-white/70">GitHub Official Signed Releases</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              soundManager.play(SoundEvent.CLICK);
              openWhatsNew();
            }}
            data-nav-item="true"
            className="rounded-full !px-4 text-xs text-white/70 border-white/[0.12] hover:bg-white/[0.06] flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            What's New
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleManualCheck}
            disabled={isManualChecking || status === 'checking' || status === 'downloading'}
            data-nav-item="true"
            className="rounded-full !px-5 text-xs !bg-white hover:!bg-white/90 !text-[#101114] font-semibold flex items-center gap-2 shadow-lg shadow-white/10"
          >
            {isManualChecking || status === 'checking' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#101114]" />
                Checking...
              </>
            ) : hasUpdate ? (
              <>
                <ArrowUpCircle className="w-3.5 h-3.5 text-[#101114]" />
                View Update (v{availableVersion})
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-[#101114]" />
                Check for Updates
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Status Banner */}
      <div className="p-4 px-5 rounded-xl bg-white/[0.015] border border-white/[0.05] flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-white/70">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-white/40" />
            <span>Last checked: {formattedLastChecked}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cryptographic Verification: Active (Minisign Ed25519)</span>
          </div>
        </div>

        {hasUpdate ? (
          <button
            onClick={() => {
              soundManager.play(SoundEvent.CLICK);
              openDialog();
            }}
            data-nav-item="true"
            className="text-amber-400 hover:text-amber-300 font-medium underline flex items-center gap-1"
          >
            <span>Update v{availableVersion} Ready to Install</span>
          </button>
        ) : status === 'up-to-date' ? (
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            CHECKPOINT is up to date
          </span>
        ) : null}
      </div>

      {/* 3. Automatic Updates Preferences */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold uppercase tracking-wider text-white/70 font-['Plus_Jakarta_Sans',sans-serif]">
          Update Automation & Preferences
        </h4>

        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.04]">
          {/* Automatically check */}
          <div className="p-4 px-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="pref-auto-check" className="text-sm font-semibold text-white block cursor-pointer">
                Automatically Check for Updates
              </label>
              <p className="text-xs text-white/50">
                Periodically check GitHub release endpoints in the background without interrupting gameplay.
              </p>
            </div>
            <input
              id="pref-auto-check"
              type="checkbox"
              checked={preferences.autoCheck}
              onChange={(e) => updatePreferences({ autoCheck: e.target.checked })}
              data-nav-item="true"
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-400 cursor-pointer"
            />
          </div>

          {/* Automatically download */}
          <div className="p-4 px-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="pref-auto-download" className="text-sm font-semibold text-white block cursor-pointer">
                Automatically Download Updates
              </label>
              <p className="text-xs text-white/50">
                Download verified updates in the background. Installation always requires your explicit confirmation.
              </p>
            </div>
            <input
              id="pref-auto-download"
              type="checkbox"
              checked={preferences.autoDownload}
              onChange={(e) => updatePreferences({ autoDownload: e.target.checked })}
              data-nav-item="true"
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-400 cursor-pointer"
            />
          </div>

          {/* Notify available */}
          <div className="p-4 px-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="pref-notify" className="text-sm font-semibold text-white block cursor-pointer">
                Notify When Updates Are Available
              </label>
              <p className="text-xs text-white/50">
                Display subtle top-bar indicators and play an original notification sound when a new version is released.
              </p>
            </div>
            <input
              id="pref-notify"
              type="checkbox"
              checked={preferences.notifyAvailable}
              onChange={(e) => updatePreferences({ notifyAvailable: e.target.checked })}
              data-nav-item="true"
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-400 cursor-pointer"
            />
          </div>

          {/* Defer while gaming */}
          <div className="p-4 px-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="pref-defer-gaming" className="text-sm font-semibold text-white block cursor-pointer">
                Defer Updates While Gaming
              </label>
              <p className="text-xs text-white/50">
                Suppresses background update operations and notifications during active game sessions.
              </p>
            </div>
            <input
              id="pref-defer-gaming"
              type="checkbox"
              checked={preferences.deferWhileGaming}
              onChange={(e) => updatePreferences({ deferWhileGaming: e.target.checked })}
              data-nav-item="true"
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-400 cursor-pointer"
            />
          </div>

          {/* Check Frequency */}
          <div className="p-4 px-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="pref-freq" className="text-sm font-semibold text-white block">
                Update Check Frequency
              </label>
              <p className="text-xs text-white/50">
                How frequently CHECKPOINT checks for new releases while running.
              </p>
            </div>
            <select
              id="pref-freq"
              value={preferences.checkIntervalHours}
              onChange={(e) => updatePreferences({ checkIntervalHours: parseInt(e.target.value, 10) || 24 })}
              data-nav-item="true"
              className="px-3 py-1.5 rounded-lg bg-[#0C0F12] border border-white/10 text-xs text-white/90 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
            >
              <option value={6}>Every 6 hours</option>
              <option value={12}>Every 12 hours</option>
              <option value={24}>Every 24 hours (Recommended)</option>
              <option value={168}>Weekly</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Release Links & Verification Info */}
      <div className="p-4 px-5 rounded-xl bg-white/[0.015] border border-white/[0.05] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white/50">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-white/40 shrink-0" />
          <span>Updates are signed with an Ed25519 private key and served over HTTPS directly from GitHub Releases.</span>
        </div>
        <a
          href="https://github.com/kamalesh-io/checkpoint-gaming-hub/releases"
          target="_blank"
          rel="noopener noreferrer"
          data-nav-item="true"
          className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 rounded px-1"
        >
          <span>GitHub Releases Repository</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
