import { useEffect, useState } from 'react';
import { Gamepad2, MonitorPlay, RotateCcw, Sliders, Wrench } from 'lucide-react';
import { ControllerGlyph } from '@/components/controller/ControllerGlyph';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import { controllerManager } from '@/services/gamepad/controllerManager';
import {
  ACTION_LABELS,
  STANDARD_BUTTON_NAMES,
  type ControllerAction,
  type ControllerRawTelemetry,
  type GlyphMode,
  type InputProviderMode,
} from '@/services/gamepad/types';
import { useControllerStore } from '@/stores/controllerStore';
import { cn } from '@/utils/cn';

const MAPPABLE_BUTTONS = [0, 1, 2, 3, 4, 5, 6, 7, 9];
const MAPPABLE_ACTIONS: ControllerAction[] = [
  'CONFIRM',
  'BACK',
  'QUICK_ACTION',
  'SEARCH',
  'PREVIOUS_TAB',
  'NEXT_TAB',
  'PREVIOUS_PAGE',
  'NEXT_PAGE',
  'MENU',
];

function StickVisualizer({
  label,
  rawX,
  rawY,
  normX,
  normY,
  deadzone,
}: {
  label: string;
  rawX: number;
  rawY: number;
  normX: number;
  normY: number;
  deadzone: number;
}) {
  const deadzonePct = Math.round(deadzone * 100);
  const dotX = 50 + rawX * 42;
  const dotY = 50 + rawY * 42;

  return (
    <div className="rounded-xl border border-outline/70 bg-surface/55 p-4 flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between text-body-sm">
        <span className="font-medium text-on-surface">{label}</span>
        <span className="tabular-nums text-[12px] text-muted">
          Norm ({normX.toFixed(2)}, {normY.toFixed(2)})
        </span>
      </div>

      <div className="relative h-28 w-28 rounded-full border border-outline bg-background/90">
        {/* Deadzone circle */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-accent-active/50 bg-accent-active/10"
          style={{ width: `${deadzonePct}%`, height: `${deadzonePct}%` }}
        />
        {/* Crosshair */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-outline/50" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-outline/50" />
        {/* Live dot */}
        <div
          className={cn(
            'absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors',
            normX !== 0 || normY !== 0
              ? 'bg-accent-active shadow-[0_0_12px_var(--accent-active)]'
              : 'bg-muted/70',
          )}
          style={{ left: `${dotX}%`, top: `${dotY}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Persisted Controller & Big Picture settings + live hardware input telemetry tester.
 */
export function ControllerSettingsPanel() {
  const enabled = useControllerStore((s) => s.enabled);
  const deadzone = useControllerStore((s) => s.deadzone);
  const repeatDelayMs = useControllerStore((s) => s.repeatDelayMs);
  const repeatIntervalMs = useControllerStore((s) => s.repeatIntervalMs);
  const glyphPreference = useControllerStore((s) => s.glyphPreference);
  const providerPreference = useControllerStore((s) => s.providerPreference);
  const startInBigPicture = useControllerStore((s) => s.startInBigPicture);
  const buttonMappings = useControllerStore((s) => s.buttonMappings);

  const connectedControllers = useControllerStore((s) => s.connectedControllers);
  const activeControllerName = useControllerStore((s) => s.activeControllerName);
  const activeControllerProfile = useControllerStore((s) => s.activeControllerProfile);
  const activeProvider = useControllerStore((s) => s.activeProvider);
  const gamepadApiSupported = useControllerStore((s) => s.gamepadApiSupported);

  const setEnabled = useControllerStore((s) => s.setEnabled);
  const setDeadzone = useControllerStore((s) => s.setDeadzone);
  const setRepeatDelayMs = useControllerStore((s) => s.setRepeatDelayMs);
  const setRepeatIntervalMs = useControllerStore((s) => s.setRepeatIntervalMs);
  const setGlyphPreference = useControllerStore((s) => s.setGlyphPreference);
  const setProviderPreference = useControllerStore((s) => s.setProviderPreference);
  const setStartInBigPicture = useControllerStore((s) => s.setStartInBigPicture);
  const remapButton = useControllerStore((s) => s.remapButton);
  const restoreDefaultMappings = useControllerStore((s) => s.restoreDefaultMappings);

  const [testerOpen, setTesterOpen] = useState(false);
  const [telemetry, setTelemetry] = useState<ControllerRawTelemetry | null>(null);

  useEffect(() => {
    if (!testerOpen) return;
    const unsub = controllerManager.subscribeTelemetry((t) => {
      setTelemetry(t);
    });
    return () => unsub();
  }, [testerOpen]);

  const previewGlyphProfile =
    glyphPreference === 'playstation'
      ? 'playstation'
      : glyphPreference === 'keyboard'
        ? 'keyboard'
        : glyphPreference === 'xbox'
          ? 'xbox'
          : activeControllerProfile === 'playstation'
            ? 'playstation'
            : 'xbox';

  return (
    <section className="rounded-2xl border border-outline/75 bg-secondary-background/80 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Gamepad2 className="h-5 w-5 text-accent-active" />
          <div>
            <h2 className="font-headline text-headline-md text-on-background">
              Controller & Big Picture Mode
            </h2>
            <p className="text-body-sm text-muted">
              Xbox, PlayStation DualShock/DualSense, spatial navigation, deadzones, and button mappings.
            </p>
          </div>
        </div>
        <Badge tone={connectedControllers.length > 0 ? 'success' : 'neutral'} size="sm">
          {connectedControllers.length > 0
            ? `${activeControllerName ?? 'Controller'} Connected`
            : 'No Physical Controller Detected'}
        </Badge>
      </div>

      {/* Hardware Telemetry Strip */}
      <div className="grid gap-3 sm:grid-cols-4 text-body-sm">
        <div className="rounded-xl border border-outline/70 bg-surface/45 p-3.5">
          <span className="text-muted block text-[11px] uppercase">Detected Hardware</span>
          <span className="text-on-surface font-medium truncate block mt-0.5">
            {connectedControllers.length > 0
              ? activeControllerName || 'Connected Gamepad'
              : 'None attached'}
          </span>
        </div>
        <div className="rounded-xl border border-outline/70 bg-surface/45 p-3.5">
          <span className="text-muted block text-[11px] uppercase">Controller Profile</span>
          <span className="text-on-surface font-medium capitalize block mt-0.5">
            {activeControllerProfile ?? 'Unassigned'}
          </span>
        </div>
        <div className="rounded-xl border border-outline/70 bg-surface/45 p-3.5">
          <span className="text-muted block text-[11px] uppercase">Input Provider</span>
          <span className="text-on-surface font-medium block mt-0.5">
            {activeProvider === 'web_gamepad'
              ? 'Web Gamepad API'
              : activeProvider === 'rust_gilrs'
                ? 'Native Rust (gilrs)'
                : activeProvider === 'synthetic'
                  ? 'Synthetic Harness'
                  : gamepadApiSupported
                    ? 'Web Gamepad API (Standby)'
                    : 'Rust (gilrs Fallback)'}
          </span>
        </div>
        <div className="rounded-xl border border-outline/70 bg-surface/45 p-3.5">
          <span className="text-muted block text-[11px] uppercase">WebView2 Gamepad API</span>
          <span className="text-on-surface font-medium block mt-0.5">
            {gamepadApiSupported ? 'Supported' : 'Unavailable'}
          </span>
        </div>
      </div>

      {/* Core Enable & Startup Toggles */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-outline/70 bg-surface/50 p-4">
          <Checkbox
            label="Enable controller navigation"
            description="Navigate Desktop & Big Picture screens via gamepad (suspended automatically when unfocused)."
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </div>
        <div className="rounded-xl border border-outline/70 bg-surface/50 p-4">
          <Checkbox
            label="Start in Big Picture Mode"
            description="Launch directly into the fullscreen 10-foot console experience on application startup."
            checked={startInBigPicture}
            onChange={(e) => setStartInBigPicture(e.target.checked)}
          />
        </div>
      </div>

      {/* Preferences & Deadzone / Repeat Calibration */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Controller Glyph Style"
          value={glyphPreference}
          onChange={(e) => setGlyphPreference(e.target.value as GlyphMode)}
          options={[
            { value: 'auto', label: 'Auto-Detect (Xbox / PlayStation / Keyboard)' },
            { value: 'xbox', label: 'Xbox Prompts (A / B / X / Y)' },
            { value: 'playstation', label: 'PlayStation Prompts (Cross / Circle / Square / Triangle)' },
            { value: 'keyboard', label: 'Keyboard Keycaps' },
          ]}
        />

        <Select
          label="Hardware Input Provider"
          value={providerPreference}
          onChange={(e) => setProviderPreference(e.target.value as InputProviderMode)}
          options={[
            { value: 'auto', label: 'Auto (Web Gamepad Primary + Rust gilrs Fallback)' },
            { value: 'web_gamepad', label: 'Web Gamepad API Only' },
            { value: 'rust_gilrs', label: 'Native Rust (gilrs) Driver Bridge' },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 rounded-xl border border-outline/70 bg-surface/40 p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-muted font-medium">Analog Stick Deadzone</span>
            <span className="tabular-nums font-semibold text-on-surface">
              {Math.round(deadzone * 100)}%
            </span>
          </div>
          <input
            type="range"
            data-nav-item="true"
            min={5}
            max={35}
            step={1}
            value={Math.round(deadzone * 100)}
            onChange={(e) => setDeadzone(Number(e.target.value) / 100)}
            aria-label="Analog Stick Deadzone Percentage"
            className="w-full accent-[var(--accent-active)] cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-muted font-medium">Hold Repeat Delay</span>
            <span className="tabular-nums font-semibold text-on-surface">{repeatDelayMs}ms</span>
          </div>
          <input
            type="range"
            data-nav-item="true"
            min={200}
            max={800}
            step={25}
            value={repeatDelayMs}
            onChange={(e) => setRepeatDelayMs(Number(e.target.value))}
            aria-label="Button Repeat Delay Milliseconds"
            className="w-full accent-[var(--accent-active)] cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-body-sm">
            <span className="text-muted font-medium">Navigation Speed</span>
            <span className="tabular-nums font-semibold text-on-surface">{repeatIntervalMs}ms</span>
          </div>
          <input
            type="range"
            data-nav-item="true"
            min={60}
            max={250}
            step={10}
            value={repeatIntervalMs}
            onChange={(e) => setRepeatIntervalMs(Number(e.target.value))}
            aria-label="Navigation Repeat Interval Milliseconds"
            className="w-full accent-[var(--accent-active)] cursor-pointer"
          />
        </div>
      </div>

      {/* Button Remapping */}
      <div className="space-y-3 border-t border-outline/60 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-accent-active" />
            <h3 className="font-headline text-headline-sm text-on-background">
              Controller Button Mapping
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={restoreDefaultMappings}
          >
            Restore Default Mappings
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MAPPABLE_BUTTONS.map((btnIdx) => (
            <div
              key={btnIdx}
              className="rounded-xl border border-outline/65 bg-surface/45 p-3 space-y-2"
            >
              <span className="text-[12px] font-medium text-muted block truncate">
                {STANDARD_BUTTON_NAMES[btnIdx]}
              </span>
              <Select
                aria-label={STANDARD_BUTTON_NAMES[btnIdx]}
                value={buttonMappings[btnIdx] ?? 'CONFIRM'}
                onChange={(e) => remapButton(btnIdx, e.target.value as ControllerAction)}
                options={MAPPABLE_ACTIONS.map((a) => ({ value: a, label: ACTION_LABELS[a] }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Live Controller Input Test Screen */}
      <div className="space-y-4 border-t border-outline/60 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-accent-active" />
            <h3 className="font-headline text-headline-sm text-on-background">
              Controller Input Diagnostic Tester
            </h3>
          </div>
          <Button
            variant={testerOpen ? 'accent' : 'secondary'}
            size="sm"
            leftIcon={<MonitorPlay className="h-3.5 w-3.5" />}
            onClick={() => setTesterOpen((o) => !o)}
          >
            {testerOpen ? 'Close Input Tester' : 'Open Input Tester'}
          </Button>
        </div>

        {testerOpen && (
          <div className="rounded-2xl border border-outline bg-background/70 p-5 space-y-5">
            {!telemetry ? (
              <p className="text-body-sm text-muted text-center py-4">
                No active physical controller stream right now. Connect an Xbox or PlayStation controller
                and move a stick or press any button to inspect real-time values.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
                  <span className="font-medium text-on-surface">
                    Active Stream: <strong className="text-accent-active">{telemetry.name}</strong>
                  </span>
                  <span className="text-muted">
                    Provider: {telemetry.provider} · Profile: {telemetry.profile}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <StickVisualizer
                    label="Left Stick (Nav)"
                    rawX={telemetry.rawAxes[0]}
                    rawY={telemetry.rawAxes[1]}
                    normX={telemetry.leftStick.x}
                    normY={telemetry.leftStick.y}
                    deadzone={deadzone}
                  />
                  <StickVisualizer
                    label="Right Stick (Scroll)"
                    rawX={telemetry.rawAxes[2]}
                    rawY={telemetry.rawAxes[3]}
                    normX={telemetry.rightStick.x}
                    normY={telemetry.rightStick.y}
                    deadzone={deadzone}
                  />
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-[12px]">
                  {telemetry.buttons.slice(0, 16).map((val, idx) => {
                    const active = val >= 0.5;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'rounded-lg border px-2 py-2 text-center tabular-nums transition-colors',
                          active
                            ? 'border-accent-active bg-accent-active/20 text-on-background font-semibold'
                            : 'border-outline/70 bg-surface/45 text-muted',
                        )}
                      >
                        <div>B{idx}</div>
                        <div className="text-[11px] opacity-80">{val.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center gap-4 border-t border-outline/60 pt-3 text-body-sm text-muted">
              <span>Preview Glyphs ({previewGlyphProfile}):</span>
              <ControllerGlyph button="CONFIRM" profile={previewGlyphProfile} />
              <ControllerGlyph button="BACK" profile={previewGlyphProfile} />
              <ControllerGlyph button="QUICK_ACTION" profile={previewGlyphProfile} />
              <ControllerGlyph button="SEARCH" profile={previewGlyphProfile} />
              <ControllerGlyph button="LB" profile={previewGlyphProfile} />
              <ControllerGlyph button="RB" profile={previewGlyphProfile} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
