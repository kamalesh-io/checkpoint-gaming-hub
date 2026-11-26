import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '@/services/api';
import { useControllerStore } from '@/stores/controllerStore';
import {
  GamepadInputEngine,
  selectActiveGamepad,
  toConnectedControllerInfo,
} from './gamepadNormalizer';
import type {
  ActiveInputProvider,
  ControllerActionEvent,
  ControllerRawTelemetry,
  GamepadSnapshot,
} from './types';

type ActionListener = (event: ControllerActionEvent) => void;
type TelemetryListener = (telemetry: ControllerRawTelemetry | null) => void;

class ControllerManagerService {
  private engine = new GamepadInputEngine();
  private actionListeners = new Set<ActionListener>();
  private telemetryListeners = new Set<TelemetryListener>();
  private nativeSnapshots: GamepadSnapshot[] = [];
  private syntheticSnapshot: GamepadSnapshot | null = null;
  private rafId: number | null = null;
  private started = false;
  private nativePollingActive = false;
  private unlistenNative: UnlistenFn | null = null;
  private cleanupWindowListeners: (() => void) | null = null;
  private lastConnectedCheckMs = 0;

  public start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    const apiSupported =
      typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
    useControllerStore.getState().setGamepadApiSupported(apiSupported);

    if (!document.documentElement.dataset.inputMode) {
      document.documentElement.dataset.inputMode = useControllerStore.getState().activeInputDevice;
    }

    const onGamepadChange = () => {
      this.pollOnce(performance.now());
    };

    const onFocusChange = () => {
      const focused = document.visibilityState === 'visible' && document.hasFocus();
      useControllerStore.getState().setWindowFocused(focused);
      if (!focused) {
        this.engine.reset();
        void this.syncNativePolling(false);
      } else {
        this.scheduleFrame();
      }
    };

    const onPointerActivity = () => {
      useControllerStore.getState().setActiveInputDevice('mouse');
    };

    const onKeyboardActivity = () => {
      useControllerStore.getState().setActiveInputDevice('keyboard');
    };

    window.addEventListener('gamepadconnected', onGamepadChange);
    window.addEventListener('gamepaddisconnected', onGamepadChange);
    window.addEventListener('focus', onFocusChange);
    window.addEventListener('blur', onFocusChange);
    document.addEventListener('visibilitychange', onFocusChange);
    window.addEventListener('pointerdown', onPointerActivity, { passive: true });
    window.addEventListener('keydown', onKeyboardActivity, { passive: true });

    this.cleanupWindowListeners = () => {
      window.removeEventListener('gamepadconnected', onGamepadChange);
      window.removeEventListener('gamepaddisconnected', onGamepadChange);
      window.removeEventListener('focus', onFocusChange);
      window.removeEventListener('blur', onFocusChange);
      document.removeEventListener('visibilitychange', onFocusChange);
      window.removeEventListener('pointerdown', onPointerActivity);
      window.removeEventListener('keydown', onKeyboardActivity);
    };

    if (isTauriRuntime()) {
      void this.attachNativeBridge();
    }

    this.scheduleFrame();
  }

  public stop(): void {
    this.started = false;
    if (this.rafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.cleanupWindowListeners?.();
    this.cleanupWindowListeners = null;
    this.unlistenNative?.();
    this.unlistenNative = null;
    void this.syncNativePolling(false);
    this.engine.reset();
  }

  public subscribeActions(listener: ActionListener): () => void {
    this.actionListeners.add(listener);
    return () => {
      this.actionListeners.delete(listener);
    };
  }

  public subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  /** Allows test harnesses & diagnostics to inject deterministic controller frames cleanly. */
  public injectSyntheticSnapshot(
    snapshot: GamepadSnapshot | null,
    timestampMs = performance.now(),
  ): ControllerActionEvent[] {
    this.syntheticSnapshot = snapshot;
    return this.processChosenSnapshots(snapshot ? [snapshot] : [], 'synthetic', timestampMs);
  }

  private async attachNativeBridge(): Promise<void> {
    try {
      this.unlistenNative = await listen<GamepadSnapshot[]>(
        'checkpoint://gamepad-state',
        (event) => {
          this.nativeSnapshots = Array.isArray(event.payload) ? event.payload : [];
        },
      );
      const initial = await invoke<GamepadSnapshot[]>('get_native_gamepads').catch(() => []);
      if (Array.isArray(initial)) {
        this.nativeSnapshots = initial;
      }
    } catch {
      // Safe no-op outside desktop shell
    }
  }

  private async syncNativePolling(shouldPoll: boolean): Promise<void> {
    if (!isTauriRuntime() || this.nativePollingActive === shouldPoll) return;
    this.nativePollingActive = shouldPoll;
    try {
      await invoke('set_native_gamepad_polling', { enabled: shouldPoll });
    } catch {
      // Safe fallback
    }
  }

  private readWebGamepads(): GamepadSnapshot[] {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return [];
    }
    try {
      const list = navigator.getGamepads();
      const snapshots: GamepadSnapshot[] = [];
      for (let i = 0; i < list.length; i++) {
        const gp = list[i];
        if (!gp || !gp.connected) continue;
        snapshots.push({
          index: gp.index,
          id: gp.id,
          connected: gp.connected,
          mapping: gp.mapping,
          buttons: gp.buttons.map((b) => Math.max(b.value ?? 0, b.pressed ? 1 : 0)),
          axes: Array.from(gp.axes),
        });
      }
      return snapshots;
    } catch {
      return [];
    }
  }

  private scheduleFrame(): void {
    if (!this.started || typeof window === 'undefined') return;
    if (this.rafId !== null) return;

    const tick = (now: number) => {
      this.rafId = null;
      if (!this.started) return;

      const store = useControllerStore.getState();
      const focused = document.visibilityState === 'visible' && document.hasFocus();

      // Suspend controller polling completely when minimized, hidden, or unfocused (game/other app active)
      if (!store.enabled || !focused) {
        void this.syncNativePolling(false);
        return;
      }

      this.pollOnce(now);
      this.rafId = window.requestAnimationFrame(tick);
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  private pollOnce(now: number): void {
    const store = useControllerStore.getState();
    if (!store.enabled) return;

    if (this.syntheticSnapshot) {
      this.processChosenSnapshots([this.syntheticSnapshot], 'synthetic', now);
      return;
    }

    const webPads =
      store.providerPreference === 'rust_gilrs' ? [] : this.readWebGamepads();

    // Throttle periodic native presence checks when Web Gamepad reports 0 pads (~1Hz)
    if (
      isTauriRuntime() &&
      store.providerPreference !== 'web_gamepad' &&
      webPads.length === 0 &&
      now - this.lastConnectedCheckMs > 1000
    ) {
      this.lastConnectedCheckMs = now;
      void invoke<GamepadSnapshot[]>('get_native_gamepads')
        .then((pads) => {
          if (Array.isArray(pads)) this.nativeSnapshots = pads;
        })
        .catch(() => undefined);
    }

    // Strict deduplication: Web Gamepad API owns input when present (unless user explicitly forces gilrs)
    let chosenPads: GamepadSnapshot[] = [];
    let chosenProvider: ActiveInputProvider = 'none';

    if (store.providerPreference === 'rust_gilrs') {
      chosenPads = this.nativeSnapshots;
      chosenProvider = chosenPads.length > 0 ? 'rust_gilrs' : 'none';
      void this.syncNativePolling(true);
    } else if (webPads.length > 0) {
      chosenPads = webPads;
      chosenProvider = 'web_gamepad';
      void this.syncNativePolling(false);
    } else if (store.providerPreference === 'auto' && this.nativeSnapshots.length > 0) {
      chosenPads = this.nativeSnapshots;
      chosenProvider = 'rust_gilrs';
      void this.syncNativePolling(true);
    } else {
      void this.syncNativePolling(false);
    }

    this.processChosenSnapshots(chosenPads, chosenProvider, now);
  }

  private processChosenSnapshots(
    pads: GamepadSnapshot[],
    provider: ActiveInputProvider,
    now: number,
  ): ControllerActionEvent[] {
    const store = useControllerStore.getState();
    const activePad = selectActiveGamepad(pads, store.activeControllerIndex, store.deadzone);

    const connectedInfos = pads.map((p) => toConnectedControllerInfo(p, provider));
    const activeInfo = activePad
      ? connectedInfos.find((c) => c.index === activePad.index) ?? null
      : null;

    store.setHardwareState({
      connectedControllers: connectedInfos,
      activeControllerIndex: activeInfo ? activeInfo.index : null,
      activeControllerName: activeInfo ? activeInfo.name : null,
      activeControllerProfile: activeInfo ? activeInfo.profile : null,
      activeProvider: activeInfo ? provider : 'none',
    });

    const { events, telemetry } = this.engine.processSnapshot(
      activePad,
      now,
      {
        deadzone: store.deadzone,
        repeatDelayMs: store.repeatDelayMs,
        repeatIntervalMs: store.repeatIntervalMs,
        buttonMappings: store.buttonMappings,
      },
      provider,
    );

    if (this.telemetryListeners.size > 0) {
      for (const listener of this.telemetryListeners) {
        listener(telemetry);
      }
    }

    if (events.length > 0) {
      const hasMeaningfulInput = events.some(
        (e) =>
          e.action !== 'SCROLL' ||
          Math.abs(e.scrollDx ?? 0) > 0.1 ||
          Math.abs(e.scrollDy ?? 0) > 0.1,
      );
      if (hasMeaningfulInput) {
        store.setActiveInputDevice('controller');
      }
      for (const ev of events) {
        for (const listener of this.actionListeners) {
          listener(ev);
        }
      }
    }

    return events;
  }
}

export const controllerManager = new ControllerManagerService();
