import { SoundEvent, type SoundEventType } from './soundEvents';
import {
  DEFAULT_SOUND_PREFERENCES,
  SOUND_STORAGE_KEY,
  type SoundPreferences,
} from './soundConfig';

/**
 * Web Audio API Sound Synthesizer & Manager
 * Produces original PlayStation-inspired acoustic cues entirely via browser Web Audio API:
 * - Clean sine/triangle oscillators
 * - Exponential decay envelopes
 * - Biquad resonant filters
 * - Ambient pad synthesizer
 * 100% offline, zero external asset dependencies, zero latency.
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientLfo: OscillatorNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private isAmbientPlaying = false;
  private lastPlayTime: Record<string, number> = {};
  private prefs: SoundPreferences;

  constructor() {
    this.prefs = this.loadPreferences();
  }

  private loadPreferences(): SoundPreferences {
    try {
      const stored = localStorage.getItem(SOUND_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SOUND_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_SOUND_PREFERENCES };
  }

  public savePreferences(updated: Partial<SoundPreferences>): void {
    this.prefs = { ...this.prefs, ...updated };
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      // ignore
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.prefs.masterEnabled ? this.prefs.masterVolume : 0,
        this.ctx.currentTime,
      );
    }
    if (this.prefs.ambientEnabled) {
      this.startAmbient();
    } else {
      this.stopAmbient();
    }
  }

  public getPreferences(): SoundPreferences {
    return { ...this.prefs };
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.prefs.masterEnabled ? this.prefs.masterVolume : 0,
        this.ctx.currentTime,
      );
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Play synthesized sound effect
   */
  public play(event: SoundEventType): void {
    if (!this.prefs.masterEnabled || this.prefs.masterVolume <= 0) return;

    // Category toggles
    if (event === SoundEvent.NAV_MOVE && !this.prefs.navSoundsEnabled) return;
    if (
      (event === SoundEvent.NAV_SELECT || event === SoundEvent.BUTTON_CLICK) &&
      !this.prefs.buttonSoundsEnabled
    ) {
      return;
    }
    if (
      (event === SoundEvent.MODAL_OPEN || event === SoundEvent.MODAL_CLOSE) &&
      !this.prefs.modalSoundsEnabled
    ) {
      return;
    }
    if (event === SoundEvent.GAME_LAUNCH && !this.prefs.gameLaunchSoundsEnabled) return;
    if (event === SoundEvent.ACHIEVEMENT && !this.prefs.achievementSoundsEnabled) return;

    // Rate limiting for navigation sounds (prevent audio clutter on rapid scrolling)
    const now = Date.now();
    const last = this.lastPlayTime[event] || 0;
    if (event === SoundEvent.NAV_MOVE && now - last < 45) return;
    this.lastPlayTime[event] = now;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;

    switch (event) {
      case SoundEvent.NAV_MOVE:
        this.synthNavMove(ctx, t);
        break;
      case SoundEvent.CLICK:
      case SoundEvent.BUTTON_CLICK:
        this.synthClick(ctx, t);
        break;
      case SoundEvent.SELECT:
      case SoundEvent.NAV_SELECT:
        this.synthNavSelect(ctx, t);
        break;
      case SoundEvent.DONE:
        this.synthDone(ctx, t);
        break;
      case SoundEvent.NEXT_PAGE:
        this.synthNextPage(ctx, t);
        break;
      case SoundEvent.NAV_BACK:
        this.synthNavBack(ctx, t);
        break;
      case SoundEvent.NAV_TAB:
        this.synthNavTab(ctx, t);
        break;
      case SoundEvent.MODAL_OPEN:
        this.synthModalOpen(ctx, t);
        break;
      case SoundEvent.MODAL_CLOSE:
        this.synthModalClose(ctx, t);
        break;
      case SoundEvent.GAME_LAUNCH:
        this.synthGameLaunch(ctx, t);
        break;
      case SoundEvent.ACHIEVEMENT:
        this.synthAchievement(ctx, t);
        break;
      case SoundEvent.TOGGLE:
        this.synthToggle(ctx, t);
        break;
      case SoundEvent.NOTIFICATION:
        this.synthNotification(ctx, t);
        break;
      default:
        this.synthNavSelect(ctx, t);
        break;
    }
  }

  /* ── 1. Soft Console Nav Movement (warm, gentle, 45ms tick) ── */
  private synthNavMove(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.045);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /* ── 2. Console Select / Confirm (PlayStation-like soft dual-tone chime) ── */
  private synthNavSelect(ctx: AudioContext, t: number): void {
    [587.33, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const delay = i * 0.035;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);

      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.22, t + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + delay);
      osc.stop(t + delay + 0.18);
    });
  }

  /* ── 3. Console Back / Cancel (descending soft tone) ── */
  private synthNavBack(ctx: AudioContext, t: number): void {
    [783.99, 523.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const delay = i * 0.035;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);

      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.18, t + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + delay);
      osc.stop(t + delay + 0.16);
    });
  }

  /* ── 4. Tab Switch (airy filtered pop) ── */
  private synthNavTab(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.06);

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  /* ── 5. Modal Open (smooth ascending sweep) ── */
  private synthModalOpen(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.18);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + 0.18);

    gain.gain.setValueAtTime(0.02, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.24);
  }

  /* ── 6. Modal Close (smooth descending sweep) ── */
  private synthModalClose(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.14);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  /* ── 7. Game Launch (deep cinematic resonance + rising harmony) ── */
  private synthGameLaunch(ctx: AudioContext, t: number): void {
    // Sub-bass thump
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(45, t + 0.4);
    subGain.gain.setValueAtTime(0.4, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    sub.connect(subGain);
    subGain.connect(this.masterGain!);
    sub.start(t);
    sub.stop(t + 0.5);

    // Cinematic chord arpeggio
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const offset = 0.05 + idx * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + offset);

      gain.gain.setValueAtTime(0, t + offset);
      gain.gain.linearRampToValueAtTime(0.2, t + offset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + offset);
      osc.stop(t + offset + 0.55);
    });
  }

  /* ── 8. Achievement / Trophy (majestic triad chime) ── */
  private synthAchievement(ctx: AudioContext, t: number): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const offset = idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + offset);

      gain.gain.setValueAtTime(0, t + offset);
      gain.gain.linearRampToValueAtTime(0.25, t + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + offset);
      osc.stop(t + offset + 0.45);
    });
  }

  /* ── 9. Toggle ── */
  private synthToggle(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.05);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  /* ── 10. Notification ── */
  private synthNotification(ctx: AudioContext, t: number): void {
    [659.25, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const offset = idx * 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + offset);
      gain.gain.setValueAtTime(0.18, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + offset);
      osc.stop(t + offset + 0.22);
    });
  }

  /* ── 11. Crisp Click (tactile, modern high-frequency micro-tap) ── */
  private synthClick(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.02);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(1.8, t);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.025);
  }

  /* ── 12. Done / Success (triumphant ascending major triad arpeggio) ── */
  private synthDone(ctx: AudioContext, t: number): void {
    // C5 (523.25) -> E5 (659.25) -> G5 (783.99) -> C6 (1046.5)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const offset = idx * 0.055;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + offset);

      gain.gain.setValueAtTime(0, t + offset);
      gain.gain.linearRampToValueAtTime(0.2, t + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + (idx === 3 ? 0.35 : 0.2));

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + offset);
      osc.stop(t + offset + (idx === 3 ? 0.38 : 0.22));
    });
  }

  /* ── 13. Next Page / Carousel Glide (airy resonant forward sweep) ── */
  private synthNextPage(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(740, t + 0.07);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(1600, t + 0.07);

    gain.gain.setValueAtTime(0.02, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Convenience direct invocation methods
  public playClick(): void {
    this.play(SoundEvent.CLICK);
  }

  public playSelect(): void {
    this.play(SoundEvent.SELECT);
  }

  public playDone(): void {
    this.play(SoundEvent.DONE);
  }

  public playNextPage(): void {
    this.play(SoundEvent.NEXT_PAGE);
  }

  public playBack(): void {
    this.play(SoundEvent.NAV_BACK);
  }

  /* ── 11. Ambient Pad Synthesizer (soft generative ambient background) ── */
  public startAmbient(): void {
    if (this.isAmbientPlaying || !this.prefs.ambientEnabled) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.prefs.ambientVolume, ctx.currentTime);

      this.ambientFilter = ctx.createBiquadFilter();
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(450, ctx.currentTime);

      // LFO for slow breathing filter modulation
      this.ambientLfo = ctx.createOscillator();
      this.ambientLfo.frequency.setValueAtTime(0.15, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(150, ctx.currentTime);
      this.ambientLfo.connect(lfoGain);
      lfoGain.connect(this.ambientFilter.frequency);

      // Dual detuned oscillators for lush warmth
      this.ambientOsc1 = ctx.createOscillator();
      this.ambientOsc1.type = 'sine';
      this.ambientOsc1.frequency.setValueAtTime(130.81, ctx.currentTime); // C3

      this.ambientOsc2 = ctx.createOscillator();
      this.ambientOsc2.type = 'triangle';
      this.ambientOsc2.frequency.setValueAtTime(196.0, ctx.currentTime); // G3

      this.ambientOsc1.connect(this.ambientFilter);
      this.ambientOsc2.connect(this.ambientFilter);
      this.ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain!);

      this.ambientOsc1.start();
      this.ambientOsc2.start();
      this.ambientLfo.start();

      this.isAmbientPlaying = true;
    } catch {
      // ignore
    }
  }

  public stopAmbient(): void {
    if (!this.isAmbientPlaying) return;
    try {
      this.ambientOsc1?.stop();
      this.ambientOsc2?.stop();
      this.ambientLfo?.stop();
      this.ambientOsc1?.disconnect();
      this.ambientOsc2?.disconnect();
      this.ambientLfo?.disconnect();
      this.ambientGain?.disconnect();
    } catch {
      // ignore
    }
    this.ambientOsc1 = null;
    this.ambientOsc2 = null;
    this.ambientLfo = null;
    this.ambientGain = null;
    this.isAmbientPlaying = false;
  }
}

export const soundManager = new SoundManager();
