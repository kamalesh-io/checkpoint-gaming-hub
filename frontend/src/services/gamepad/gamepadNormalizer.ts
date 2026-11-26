import {
  DEFAULT_BUTTON_MAPPINGS,
  type ActiveInputDevice,
  type ActiveInputProvider,
  type ConnectedControllerInfo,
  type ControllerAction,
  type ControllerActionEvent,
  type ControllerNormalizationSettings,
  type ControllerProfile,
  type ControllerRawTelemetry,
  type GamepadSnapshot,
  type GlyphMode,
} from './types.ts';

export interface DeadzoneVector {
  x: number;
  y: number;
  magnitude: number;
}

/**
 * Applies radial deadzone scaling as specified in docs/CONTROLLER.md:
 * magnitudes below deadzone clamp to (0, 0); magnitudes above rescale smoothly over [0, 1].
 */
export function applyRadialDeadzone(rawX: number, rawY: number, deadzone = 0.15): DeadzoneVector {
  const safeDeadzone = Math.max(0.02, Math.min(0.45, deadzone));
  const mag = Math.hypot(rawX, rawY);
  if (mag <= safeDeadzone || mag === 0) {
    return { x: 0, y: 0, magnitude: 0 };
  }

  const clampedMag = Math.min(1, mag);
  const rescaled = (clampedMag - safeDeadzone) / (1 - safeDeadzone);
  const scale = rescaled / mag;
  return {
    x: Math.max(-1, Math.min(1, rawX * scale)),
    y: Math.max(-1, Math.min(1, rawY * scale)),
    magnitude: rescaled,
  };
}

/** Identifies Xbox, PlayStation DualShock/DualSense, Nintendo, or generic controllers from device ID. */
export function resolveControllerProfile(id: string): ControllerProfile {
  const s = id.toLowerCase();
  if (
    s.includes('045e') ||
    s.includes('xbox') ||
    s.includes('x-box') ||
    s.includes('xinput')
  ) {
    return 'xbox';
  }
  if (
    s.includes('054c') ||
    s.includes('dualsense') ||
    s.includes('dualshock') ||
    s.includes('playstation') ||
    s.includes('ps5') ||
    s.includes('ps4') ||
    s === 'wireless controller' ||
    s.startsWith('wireless controller ')
  ) {
    return 'playstation';
  }
  if (s.includes('057e') || s.includes('nintendo') || s.includes('switch') || s.includes('pro controller')) {
    return 'nintendo';
  }
  return 'generic';
}

export function inferConnectionType(id: string): 'usb' | 'bluetooth' | 'unknown' {
  const s = id.toLowerCase();
  if (s.includes('bluetooth') || s.includes('bthle') || s.includes('wireless')) return 'bluetooth';
  if (s.includes('usb') || s.includes('standard gamepad') || s.includes('vendor:')) return 'usb';
  return 'unknown';
}

export function extractFriendlyControllerName(id: string, explicitName?: string): string {
  if (explicitName && explicitName.trim().length > 0) return explicitName.trim();
  const parenIdx = id.indexOf('(');
  const cleaned = (parenIdx > 2 ? id.slice(0, parenIdx) : id).trim();
  return cleaned || 'Game Controller';
}

export function toConnectedControllerInfo(
  pad: GamepadSnapshot,
  provider: ActiveInputProvider,
): ConnectedControllerInfo {
  return {
    index: pad.index,
    id: pad.id,
    name: extractFriendlyControllerName(pad.id, pad.name),
    profile: resolveControllerProfile(pad.id),
    connectionType: inferConnectionType(pad.id),
    provider,
  };
}

/** Resolves effective visual glyph palette respecting explicit manual preference & active input device. */
export function resolveEffectiveGlyphProfile(
  preference: GlyphMode,
  activeDevice: ActiveInputDevice,
  connectedProfile: ControllerProfile | null,
): 'xbox' | 'playstation' | 'keyboard' {
  if (preference === 'xbox' || preference === 'playstation' || preference === 'keyboard') {
    return preference;
  }

  if (activeDevice === 'controller' && connectedProfile) {
    if (connectedProfile === 'playstation') return 'playstation';
    return 'xbox';
  }

  if (connectedProfile && activeDevice !== 'keyboard') {
    return connectedProfile === 'playstation' ? 'playstation' : 'xbox';
  }

  return activeDevice === 'keyboard' || !connectedProfile ? 'keyboard' : 'xbox';
}

/**
 * Selects the active controller deterministically across connects/disconnects and activity switching.
 */
export function selectActiveGamepad(
  pads: GamepadSnapshot[],
  currentActiveIndex: number | null,
  deadzone = 0.15,
): GamepadSnapshot | null {
  const connected = pads.filter((p) => p.connected);
  if (connected.length === 0) return null;

  // Device switching priority: if a secondary controller shows deliberate press/stick movement, promote it
  for (const pad of connected) {
    const anyPressed = pad.buttons.some((v, idx) => idx < 16 && v > 0.5);
    const stickMoved =
      applyRadialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, deadzone).magnitude > 0.45;
    if ((anyPressed || stickMoved) && pad.index !== currentActiveIndex) {
      return pad;
    }
  }

  if (currentActiveIndex !== null) {
    const existing = connected.find((p) => p.index === currentActiveIndex);
    if (existing) return existing;
  }

  return connected[0] ?? null;
}

type DirectionAction = 'NAV_UP' | 'NAV_DOWN' | 'NAV_LEFT' | 'NAV_RIGHT';

const STICK_ENGAGE_THRESHOLD = 0.55;
const STICK_RELEASE_THRESHOLD = 0.30;
const TRIGGER_PRESS_THRESHOLD = 0.50;
const TRIGGER_RELEASE_THRESHOLD = 0.25;

/**
 * Stateful deterministic gamepad frame processor converting raw snapshots to debounced
 * application actions with hold-repeat and right-stick scroll support.
 */
export class GamepadInputEngine {
  private prevPressedButtons = new Set<number>();
  private prevTriggerActive: { left: boolean; right: boolean } = { left: false, right: false };
  private prevStickDirection: DirectionAction | null = null;
  private activeRepeatDir: DirectionAction | null = null;
  private dirPressedAt = 0;
  private lastRepeatAt = 0;
  private activePadIndex: number | null = null;

  public reset(): void {
    this.prevPressedButtons.clear();
    this.prevTriggerActive = { left: false, right: false };
    this.prevStickDirection = null;
    this.activeRepeatDir = null;
    this.dirPressedAt = 0;
    this.lastRepeatAt = 0;
  }

  public processSnapshot(
    pad: GamepadSnapshot | null,
    timestampMs: number,
    settings: ControllerNormalizationSettings,
    provider: ActiveInputProvider = 'web_gamepad',
  ): {
    events: ControllerActionEvent[];
    telemetry: ControllerRawTelemetry | null;
  } {
    if (!pad || !pad.connected) {
      this.reset();
      this.activePadIndex = null;
      return { events: [], telemetry: null };
    }

    if (this.activePadIndex !== pad.index) {
      this.reset();
      this.activePadIndex = pad.index;
    }

    const profile = resolveControllerProfile(pad.id);
    const mappings = settings.buttonMappings ?? DEFAULT_BUTTON_MAPPINGS;
    const rawLx = pad.axes[0] ?? 0;
    const rawLy = pad.axes[1] ?? 0;
    const rawRx = pad.axes[2] ?? 0;
    const rawRy = pad.axes[3] ?? 0;

    const leftStick = applyRadialDeadzone(rawLx, rawLy, settings.deadzone);
    const rightStick = applyRadialDeadzone(rawRx, rawRy, settings.deadzone);

    const events: ControllerActionEvent[] = [];
    const currentPressed = new Set<number>();
    let frameDpadDir: DirectionAction | null = null;

    // 1. Evaluate all mapped digital/face/bumper/dpad buttons (skipping analog triggers 6,7 handled separately)
    for (let idx = 0; idx < pad.buttons.length; idx++) {
      const value = pad.buttons[idx] ?? 0;
      if (idx === 6 || idx === 7) continue; // Handled cleanly with trigger hysteresis below

      const isPressed = value >= 0.5;
      if (!isPressed) continue;

      currentPressed.add(idx);
      const mappedAction = mappings[idx];
      if (!mappedAction) continue;

      if (
        mappedAction === 'NAV_UP' ||
        mappedAction === 'NAV_DOWN' ||
        mappedAction === 'NAV_LEFT' ||
        mappedAction === 'NAV_RIGHT'
      ) {
        frameDpadDir = mappedAction;
        if (!this.prevPressedButtons.has(idx)) {
          events.push({
            action: mappedAction,
            controllerIndex: pad.index,
            profile,
            isRepeat: false,
            timestamp: timestampMs,
          });
          this.activeRepeatDir = mappedAction;
          this.dirPressedAt = timestampMs;
          this.lastRepeatAt = timestampMs;
        }
      } else if (!this.prevPressedButtons.has(idx)) {
        // Non-directional buttons emit strictly once per press edge (zero bounce)
        events.push({
          action: mappedAction,
          controllerIndex: pad.index,
          profile,
          isRepeat: false,
          timestamp: timestampMs,
        });
      }
    }

    this.prevPressedButtons = currentPressed;

    // 2. Analog Triggers (LT idx 6 -> PREVIOUS_PAGE, RT idx 7 -> NEXT_PAGE) with hysteresis
    const ltVal = pad.buttons[6] ?? 0;
    const rtVal = pad.buttons[7] ?? 0;
    const ltDown = this.prevTriggerActive.left
      ? ltVal > TRIGGER_RELEASE_THRESHOLD
      : ltVal >= TRIGGER_PRESS_THRESHOLD;
    const rtDown = this.prevTriggerActive.right
      ? rtVal > TRIGGER_RELEASE_THRESHOLD
      : rtVal >= TRIGGER_PRESS_THRESHOLD;

    if (ltDown && !this.prevTriggerActive.left) {
      const action: ControllerAction = mappings[6] ?? 'PREVIOUS_PAGE';
      events.push({ action, controllerIndex: pad.index, profile, isRepeat: false, timestamp: timestampMs });
    }
    if (rtDown && !this.prevTriggerActive.right) {
      const action: ControllerAction = mappings[7] ?? 'NEXT_PAGE';
      events.push({ action, controllerIndex: pad.index, profile, isRepeat: false, timestamp: timestampMs });
    }
    this.prevTriggerActive = { left: ltDown, right: rtDown };

    // 3. Left Stick Directional Navigation with Schmitt Trigger Hysteresis
    let frameStickDir: DirectionAction | null = null;
    if (this.prevStickDirection) {
      if (leftStick.magnitude >= STICK_RELEASE_THRESHOLD) {
        frameStickDir =
          Math.abs(leftStick.x) > Math.abs(leftStick.y)
            ? leftStick.x > 0
              ? 'NAV_RIGHT'
              : 'NAV_LEFT'
            : leftStick.y > 0
              ? 'NAV_DOWN'
              : 'NAV_UP';
      }
    } else if (leftStick.magnitude >= STICK_ENGAGE_THRESHOLD) {
      frameStickDir =
        Math.abs(leftStick.x) > Math.abs(leftStick.y)
          ? leftStick.x > 0
            ? 'NAV_RIGHT'
            : 'NAV_LEFT'
          : leftStick.y > 0
            ? 'NAV_DOWN'
            : 'NAV_UP';
    }

    if (frameStickDir && frameStickDir !== this.prevStickDirection && frameStickDir !== frameDpadDir) {
      events.push({
        action: frameStickDir,
        controllerIndex: pad.index,
        profile,
        isRepeat: false,
        timestamp: timestampMs,
      });
      this.activeRepeatDir = frameStickDir;
      this.dirPressedAt = timestampMs;
      this.lastRepeatAt = timestampMs;
    }
    this.prevStickDirection = frameStickDir;

    // 4. Held-Direction Repeat Pulse (D-pad takes priority if both active)
    const heldDir = frameDpadDir ?? frameStickDir;
    if (!heldDir) {
      this.activeRepeatDir = null;
    } else if (
      this.activeRepeatDir === heldDir &&
      events.every((e) => e.action !== heldDir) &&
      timestampMs - this.dirPressedAt >= settings.repeatDelayMs &&
      timestampMs - this.lastRepeatAt >= settings.repeatIntervalMs
    ) {
      this.lastRepeatAt = timestampMs;
      events.push({
        action: heldDir,
        controllerIndex: pad.index,
        profile,
        isRepeat: true,
        timestamp: timestampMs,
      });
    }

    // 5. Right Stick Continuous Content Scrolling
    if (rightStick.magnitude > 0) {
      events.push({
        action: 'SCROLL',
        controllerIndex: pad.index,
        profile,
        isRepeat: false,
        scrollDx: rightStick.x,
        scrollDy: rightStick.y,
        timestamp: timestampMs,
      });
    }

    const telemetry: ControllerRawTelemetry = {
      index: pad.index,
      id: pad.id,
      name: extractFriendlyControllerName(pad.id, pad.name),
      profile,
      provider,
      rawAxes: [rawLx, rawLy, rawRx, rawRy],
      leftStick,
      rightStick,
      buttons: pad.buttons.slice(0, 17),
    };

    return { events, telemetry };
  }
}

export function clampDeadzoneValue(value: number): number {
  return Math.max(0.05, Math.min(0.4, value));
}

export function clampRepeatDelayMs(ms: number): number {
  return Math.max(150, Math.min(900, ms));
}

export function clampRepeatIntervalMs(ms: number): number {
  return Math.max(50, Math.min(350, ms));
}

export function applyButtonRemap(
  mappings: Record<number, ControllerAction>,
  buttonIndex: number,
  action: ControllerAction,
): Record<number, ControllerAction> {
  return { ...mappings, [buttonIndex]: action };
}

export function createDefaultButtonMappings(): Record<number, ControllerAction> {
  return { ...DEFAULT_BUTTON_MAPPINGS };
}
