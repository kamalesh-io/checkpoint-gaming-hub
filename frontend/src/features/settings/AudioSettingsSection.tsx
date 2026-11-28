import { useState } from 'react';
import { Volume2, VolumeX, Music, RotateCcw, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { soundManager } from '@/audio/soundManager';
import { SoundEvent } from '@/audio/soundEvents';
import { DEFAULT_SOUND_PREFERENCES, type SoundPreferences } from '@/audio/soundConfig';

export function AudioSettingsSection() {
  const [prefs, setPrefs] = useState<SoundPreferences>(() => soundManager.getPreferences());

  const update = (changes: Partial<SoundPreferences>) => {
    soundManager.savePreferences(changes);
    setPrefs(soundManager.getPreferences());
  };

  const resetDefaults = () => {
    soundManager.savePreferences(DEFAULT_SOUND_PREFERENCES);
    setPrefs(soundManager.getPreferences());
    soundManager.play(SoundEvent.NAV_SELECT);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-outline/75 bg-secondary-background/85 p-6 shadow-sm space-y-6">
        <div>
          <h2 className="font-headline text-headline-md font-bold text-on-background flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-accent-active" />
            Sound & Audio System
          </h2>
          <p className="text-body-sm text-muted mt-1">
            Console-inspired UI audio and ambient audio synthesized via Web Audio API.
          </p>
        </div>

        {/* Master Sound Toggle & Volume Slider */}
        <div className="rounded-xl border border-outline/70 bg-surface/80 p-4 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={prefs.masterEnabled}
                onChange={(e) => {
                  update({ masterEnabled: e.target.checked });
                  if (e.target.checked) soundManager.play(SoundEvent.NAV_SELECT);
                }}
              />
              <div>
                <span className="font-semibold text-on-background">Master Sound Effects</span>
                <p className="text-body-sm text-muted">
                  Enable PlayStation-inspired interactive audio feedback across the interface.
                </p>
              </div>
            </div>
            <span className="text-label-md font-bold text-accent-active tabular-nums">
              {prefs.masterEnabled ? `${Math.round(prefs.masterVolume * 100)}%` : 'Off'}
            </span>
          </label>

          {prefs.masterEnabled && (
            <div className="pt-2 border-t border-outline/50 space-y-2">
              <div className="flex items-center justify-between text-body-sm text-muted">
                <span className="flex items-center gap-1.5">
                  <VolumeX className="h-4 w-4" /> Min
                </span>
                <span className="flex items-center gap-1.5">
                  Max <Volume2 className="h-4 w-4" />
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(prefs.masterVolume * 100)}
                onChange={(e) => {
                  const val = Number(e.target.value) / 100;
                  update({ masterVolume: val });
                }}
                className="w-full accent-accent-active cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Detailed Category Toggles */}
        <div className="space-y-3">
          <h3 className="font-headline text-headline-sm text-on-background">Sound Event Categories</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface/60 p-3.5 hover:bg-surface/80 transition-colors">
              <Checkbox
                checked={prefs.navSoundsEnabled}
                onChange={(e) => {
                  update({ navSoundsEnabled: e.target.checked });
                  if (e.target.checked) soundManager.play(SoundEvent.NAV_MOVE);
                }}
              />
              <div>
                <span className="font-semibold">Navigation & Focus</span>
                <p className="text-[12px] text-muted">Subtle tick when moving spatial cursor</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface/60 p-3.5 hover:bg-surface/80 transition-colors">
              <Checkbox
                checked={prefs.buttonSoundsEnabled}
                onChange={(e) => {
                  update({ buttonSoundsEnabled: e.target.checked });
                  if (e.target.checked) soundManager.play(SoundEvent.NAV_SELECT);
                }}
              />
              <div>
                <span className="font-semibold">Buttons & Selections</span>
                <p className="text-[12px] text-muted">Console-style dual-tone confirmation</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface/60 p-3.5 hover:bg-surface/80 transition-colors">
              <Checkbox
                checked={prefs.modalSoundsEnabled}
                onChange={(e) => {
                  update({ modalSoundsEnabled: e.target.checked });
                  if (e.target.checked) soundManager.play(SoundEvent.MODAL_OPEN);
                }}
              />
              <div>
                <span className="font-semibold">Modals & Dialogs</span>
                <p className="text-[12px] text-muted">Soft airy whoosh on open and dismiss</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface/60 p-3.5 hover:bg-surface/80 transition-colors">
              <Checkbox
                checked={prefs.gameLaunchSoundsEnabled}
                onChange={(e) => {
                  update({ gameLaunchSoundsEnabled: e.target.checked });
                  if (e.target.checked) soundManager.play(SoundEvent.GAME_LAUNCH);
                }}
              />
              <div>
                <span className="font-semibold">Game Launch</span>
                <p className="text-[12px] text-muted">Deep cinematic sub-bass resonance</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-body-md text-on-background rounded-xl border border-outline/70 bg-surface/60 p-3.5 hover:bg-surface/80 transition-colors">
              <Checkbox
                checked={prefs.achievementSoundsEnabled}
                onChange={(e) => {
                  update({ achievementSoundsEnabled: e.target.checked });
                  if (e.target.checked) soundManager.play(SoundEvent.ACHIEVEMENT);
                }}
              />
              <div>
                <span className="font-semibold">Trophies & Milestones</span>
                <p className="text-[12px] text-muted">Majestic triad victory chime</p>
              </div>
            </label>
          </div>
        </div>

        {/* Ambient Menu Audio */}
        <div className="rounded-xl border border-outline/70 bg-surface/80 p-4 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={prefs.ambientEnabled}
                onChange={(e) => {
                  update({ ambientEnabled: e.target.checked });
                }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-accent-gold" />
                  <span className="font-semibold text-on-background">Ambient Menu Audio (Pad Loop)</span>
                </div>
                <p className="text-body-sm text-muted">
                  Warm, meditative synthesizer drone that breathes gently in the background. Disabled by default.
                </p>
              </div>
            </div>
            <span className="text-label-md font-bold text-accent-gold tabular-nums">
              {prefs.ambientEnabled ? `${Math.round(prefs.ambientVolume * 100)}%` : 'Off'}
            </span>
          </label>

          {prefs.ambientEnabled && (
            <div className="pt-2 border-t border-outline/50 space-y-2">
              <div className="flex items-center justify-between text-body-sm text-muted">
                <span>Ambient Volume</span>
                <span className="tabular-nums">{Math.round(prefs.ambientVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={Math.round(prefs.ambientVolume * 100)}
                onChange={(e) => {
                  const val = Number(e.target.value) / 100;
                  update({ ambientVolume: val });
                }}
                className="w-full accent-accent-gold cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Sound Test / Preview Controls */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-outline/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body-sm text-muted mr-1">Preview:</span>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Play className="h-3.5 w-3.5" />}
              onClick={() => soundManager.play(SoundEvent.NAV_SELECT)}
            >
              Select Chime
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Play className="h-3.5 w-3.5" />}
              onClick={() => soundManager.play(SoundEvent.GAME_LAUNCH)}
            >
              Game Launch
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Play className="h-3.5 w-3.5" />}
              onClick={() => soundManager.play(SoundEvent.ACHIEVEMENT)}
            >
              Achievement
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={resetDefaults}
          >
            Restore Audio Defaults
          </Button>
        </div>
      </div>
    </section>
  );
}
