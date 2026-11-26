import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyButtonRemap,
  applyRadialDeadzone,
  clampDeadzoneValue,
  clampRepeatDelayMs,
  clampRepeatIntervalMs,
  createDefaultButtonMappings,
  GamepadInputEngine,
  resolveControllerProfile,
  resolveEffectiveGlyphProfile,
  selectActiveGamepad,
} from '../src/services/gamepad/gamepadNormalizer.ts';
import { DEFAULT_BUTTON_MAPPINGS, type GamepadSnapshot } from '../src/services/gamepad/types.ts';
import {
  clearRouteFocusMemory,
  findBestSpatialCandidate,
  getRememberedRouteFocus,
  rememberRouteFocus,
  type NavCandidate,
} from '../src/services/spatialNav/spatialEngine.ts';

function makePad(overrides: Partial<GamepadSnapshot> = {}): GamepadSnapshot {
  return {
    index: 0,
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
    connected: true,
    mapping: 'standard',
    buttons: Array(17).fill(0),
    axes: [0, 0, 0, 0],
    ...overrides,
  };
}

test('applyRadialDeadzone clamps stick drift below 15% and rescales active movement cleanly', () => {
  const idle = applyRadialDeadzone(0.08, -0.09, 0.15);
  assert.equal(idle.x, 0);
  assert.equal(idle.y, 0);
  assert.equal(idle.magnitude, 0);

  const half = applyRadialDeadzone(0.575, 0, 0.15);
  assert.ok(Math.abs(half.x - 0.5) < 0.001);
  assert.ok(Math.abs(half.magnitude - 0.5) < 0.001);

  const maxDiag = applyRadialDeadzone(1, 1, 0.15);
  assert.ok(maxDiag.magnitude <= 1.0001);
});

test('controller profile & glyph detection distinguish Xbox, PlayStation DualSense, and overrides', () => {
  assert.equal(
    resolveControllerProfile('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'),
    'xbox',
  );
  assert.equal(
    resolveControllerProfile('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'),
    'playstation',
  );
  assert.equal(
    resolveControllerProfile('Pro Controller (Vendor: 057e Product: 2009)'),
    'nintendo',
  );

  assert.equal(resolveEffectiveGlyphProfile('auto', 'controller', 'playstation'), 'playstation');
  assert.equal(resolveEffectiveGlyphProfile('auto', 'controller', 'xbox'), 'xbox');
  assert.equal(resolveEffectiveGlyphProfile('auto', 'keyboard', null), 'keyboard');
  assert.equal(resolveEffectiveGlyphProfile('playstation', 'keyboard', 'xbox'), 'playstation');
  assert.equal(resolveEffectiveGlyphProfile('xbox', 'controller', 'playstation'), 'xbox');
});

test('selectActiveGamepad handles hot-plug, disconnect fallback, and multi-controller switching', () => {
  const pad0 = makePad({ index: 0 });
  const pad1 = makePad({
    index: 1,
    id: 'DualSense Wireless Controller (Vendor: 054c Product: 0ce6)',
    buttons: [1, ...Array(16).fill(0)],
  });

  // Active stick/button press promotes secondary controller
  const switched = selectActiveGamepad([pad0, pad1], 0, 0.15);
  assert.equal(switched?.index, 1);

  // Disconnect active pad1 -> falls back cleanly to pad0
  const afterDisconnect = selectActiveGamepad([pad0], 1, 0.15);
  assert.equal(afterDisconnect?.index, 0);

  // No connected controllers -> returns null
  assert.equal(selectActiveGamepad([], 0, 0.15), null);
});

test('GamepadInputEngine enforces edge detection, repeat timing, remapping, triggers, and right-stick scroll', () => {
  const engine = new GamepadInputEngine();
  const settings = {
    deadzone: 0.15,
    repeatDelayMs: 400,
    repeatIntervalMs: 120,
    buttonMappings: { ...DEFAULT_BUTTON_MAPPINGS },
  };

  // Frame 1: A button + D-Pad Right pressed
  const bDown = Array(17).fill(0);
  bDown[0] = 1; // CONFIRM
  bDown[15] = 1; // NAV_RIGHT
  const f1 = engine.processSnapshot(makePad({ buttons: bDown }), 1000, settings);
  assert.deepEqual(
    f1.events.map((e) => e.action),
    ['CONFIRM', 'NAV_RIGHT'],
  );

  // Frame 2 (+100ms): held buttons must NOT bounce CONFIRM or repeat NAV_RIGHT before 400ms delay
  const f2 = engine.processSnapshot(makePad({ buttons: bDown }), 1100, settings);
  assert.equal(f2.events.length, 0);

  // Frame 3 (+420ms past initial): held D-pad emits single repeat pulse
  const f3 = engine.processSnapshot(makePad({ buttons: bDown }), 1420, settings);
  assert.equal(f3.events.length, 1);
  assert.equal(f3.events[0]?.action, 'NAV_RIGHT');
  assert.equal(f3.events[0]?.isRepeat, true);

  // Frame 4 (+560ms, +140ms since last repeat): emits next repeat
  const f4 = engine.processSnapshot(makePad({ buttons: bDown }), 1560, settings);
  assert.equal(f4.events.length, 1);
  assert.equal(f4.events[0]?.action, 'NAV_RIGHT');

  // Trigger press LT/RT edge detection
  const trigDown = Array(17).fill(0);
  trigDown[6] = 0.85; // LT -> PREVIOUS_PAGE
  trigDown[7] = 0.9; // RT -> NEXT_PAGE
  const fTrig = engine.processSnapshot(makePad({ buttons: trigDown }), 1650, settings);
  assert.deepEqual(
    fTrig.events.map((e) => e.action),
    ['PREVIOUS_PAGE', 'NEXT_PAGE'],
  );

  // Release all & push right stick downward -> SCROLL action with normalized delta
  const fScroll = engine.processSnapshot(makePad({ axes: [0, 0, 0, 0.8] }), 1750, settings);
  assert.equal(fScroll.events.length, 1);
  assert.equal(fScroll.events[0]?.action, 'SCROLL');
  assert.ok((fScroll.events[0]?.scrollDy ?? 0) > 0.7);

  // Remap A button (index 0) -> QUICK_ACTION
  const remapped = applyButtonRemap(settings.buttonMappings, 0, 'QUICK_ACTION');
  const fRemap = engine.processSnapshot(
    makePad({ buttons: [1, ...Array(16).fill(0)] }),
    1850,
    { ...settings, buttonMappings: remapped },
  );
  assert.equal(fRemap.events[0]?.action, 'QUICK_ACTION');
});

test('2D spatial raycaster & route focus memory navigate and restore cleanly', () => {
  const candidates: NavCandidate<string>[] = [
    {
      id: 'card-1',
      group: 'carousel',
      rect: { left: 100, top: 300, right: 300, bottom: 420, width: 200, height: 120 },
      element: 'card-1',
    },
    {
      id: 'card-2',
      group: 'carousel',
      rect: { left: 320, top: 300, right: 520, bottom: 420, width: 200, height: 120 },
      element: 'card-2',
    },
    {
      id: 'card-3',
      group: 'carousel',
      rect: { left: 540, top: 300, right: 740, bottom: 420, width: 200, height: 120 },
      element: 'card-3',
    },
    {
      id: 'cta-open',
      group: 'hero',
      rect: { left: 100, top: 200, right: 260, bottom: 250, width: 160, height: 50 },
      element: 'cta-open',
    },
  ];

  // Moving right from card-1 chooses immediate horizontal neighbor card-2 (not card-3)
  const right = findBestSpatialCandidate(candidates[0]!.rect, 'carousel', candidates, 'right');
  assert.equal(right?.id, 'card-2');

  // Moving up from card-1 chooses cta-open directly above it
  const up = findBestSpatialCandidate(candidates[0]!.rect, 'carousel', candidates, 'up');
  assert.equal(up?.id, 'cta-open');

  // Moving down from cta-open chooses aligned card-1 below it
  const down = findBestSpatialCandidate(candidates[3]!.rect, 'hero', candidates, 'down');
  assert.equal(down?.id, 'card-1');

  // Moving left from leftmost card-1 returns null cleanly
  const left = findBestSpatialCandidate(candidates[0]!.rect, 'carousel', candidates, 'left');
  assert.equal(left, null);

  clearRouteFocusMemory();
  rememberRouteFocus('/big-picture', { dataset: { navId: 'bp-tile-elden' }, id: '' } as unknown as HTMLElement);
  assert.equal(getRememberedRouteFocus('/big-picture'), 'bp-tile-elden');
});

test('controller settings clamping, remapping, and default restoration behave accurately', () => {
  assert.equal(clampDeadzoneValue(0.01), 0.05);
  assert.equal(clampDeadzoneValue(0.9), 0.4);
  assert.equal(clampRepeatDelayMs(50), 150);
  assert.equal(clampRepeatIntervalMs(10), 50);

  const custom = applyButtonRemap(createDefaultButtonMappings(), 0, 'SEARCH');
  assert.equal(custom[0], 'SEARCH');
  const restored = createDefaultButtonMappings();
  assert.equal(restored[0], 'CONFIRM');
});
