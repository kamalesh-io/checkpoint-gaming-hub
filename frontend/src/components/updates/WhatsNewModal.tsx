import { CheckCircle2, Sparkles, X, Shield, Volume2, ArrowUpRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { soundManager } from '@/audio/soundManager';
import { SoundEvent } from '@/audio/soundEvents';
import checkpointEmblem from '@/assets/Checkpoint Gaming Emblem.png';

export function WhatsNewModal() {
  const { whatsNewOpen, closeWhatsNew, currentVersion } = useAppUpdater();

  if (!whatsNewOpen) return null;

  return (
    <Modal
      isOpen={whatsNewOpen}
      onClose={() => {
        soundManager.play(SoundEvent.CLICK);
        closeWhatsNew();
      }}
      title=""
      size="lg"
      className="!max-w-2xl !bg-[#14181D]/95 !border-white/[0.08] backdrop-blur-2xl shadow-2xl p-0 overflow-hidden"
    >
      {/* Header Banner */}
      <div className="relative p-6 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-transparent">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <img
              src={checkpointEmblem}
              alt="CHECKPOINT"
              className="w-14 h-14 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            />
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                  What's New in CHECKPOINT
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  <Sparkles className="w-3 h-3" />
                  v{currentVersion}
                </span>
              </div>
              <p className="text-sm text-white/50 mt-1 font-['DM_Sans',sans-serif]">
                Cinematic Update — Immersive visual redesign, procedural audio & automated release pipeline
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.play(SoundEvent.CLICK);
              closeWhatsNew();
            }}
            data-nav-item="true"
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6 font-['DM_Sans',sans-serif]">
        {/* Section 1: Cinematic UI V3 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider font-['Plus_Jakarta_Sans',sans-serif]">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Cinematic UI V3</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
              <p className="font-semibold text-white">Floating Navigation Dock</p>
              <p className="text-white/60 leading-relaxed">
                Replaced permanent sidebars with a PlayStation-inspired bottom floating dock that stays out of your way.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
              <p className="font-semibold text-white">Dynamic Atmosphere</p>
              <p className="text-white/60 leading-relaxed">
                Cinematic backgrounds and ambient color tones adapt dynamically to the currently selected game.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
              <p className="font-semibold text-white">Console Typography</p>
              <p className="text-white/60 leading-relaxed">
                Bundled Plus Jakarta Sans display typography and DM Sans interface text for maximum legibility.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
              <p className="font-semibold text-white">High-Res Artwork Engine</p>
              <p className="text-white/60 leading-relaxed">
                SteamGridDB integration with official 600×900 Steam capsules, 16:9 heroes, and transparent logos.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Audio & Controllers */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider font-['Plus_Jakarta_Sans',sans-serif]">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <span>Procedural Audio & Native Controllers</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
              <p className="font-semibold text-white">Synthesized Web Audio SFX</p>
              <p className="text-white/60 leading-relaxed">
                Tactile click, select, done, and transition sound effects generated procedural without external files.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
              <p className="font-semibold text-white">Steam Family Sharing Discovery</p>
              <p className="text-white/60 leading-relaxed">
                Discovers and synchronizes all Family Shared titles locally with recorded Steam playtime and Fam badges.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Verified Bug Fixes */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider font-['Plus_Jakarta_Sans',sans-serif]">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Resolved Defects (BUG-001 through BUG-020)</span>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-2 text-xs text-white/70">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Currently Playing Carousel (BUG-011):</strong> Restored landscape cards and instant hero switching.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Dynamic Accent Sync (BUG-012):</strong> Palette variables dynamically respond to game artwork.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Progress & Rating Updates (BUG-013):</strong> Personal rating, completion goal, and percentage save to SQLite.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Wishlist Separation (BUG-015):</strong> Unowned wishlist games decoupled from active library counts.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Settings & Storage (BUG-018):</strong> Cache clearing, backups, and Windows startup launch fully functional.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 px-6 border-t border-white/[0.06] bg-[#0C0F12]/60 flex items-center justify-between">
        <a
          href="https://github.com/kamalesh-io/checkpoint-gaming-hub/releases"
          target="_blank"
          rel="noopener noreferrer"
          data-nav-item="true"
          className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 rounded px-1.5 py-1"
        >
          <span>View Release on GitHub</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            soundManager.play(SoundEvent.CLICK);
            closeWhatsNew();
          }}
          data-nav-item="true"
          className="rounded-full !px-6 !bg-white hover:!bg-white/90 !text-[#101114] font-semibold shadow-lg shadow-white/10"
        >
          Got It, Let's Play
        </Button>
      </div>
    </Modal>
  );
}
