import {
  ControllerGlyph,
  type ControllerGlyphKey,
} from '@/components/controller/ControllerGlyph';
import { resolveEffectiveGlyphProfile } from '@/services/gamepad/gamepadNormalizer';
import { useControllerStore } from '@/stores/controllerStore';
import { cn } from '@/utils/cn';

export interface GlyphLegendItem {
  button: ControllerGlyphKey;
  label: string;
}

export interface ControllerGlyphLegendProps {
  items: GlyphLegendItem[];
  rightHint?: string;
  className?: string;
}

/**
 * Contextual footer legend bar displaying dynamic Xbox, PlayStation DualSense,
 * or Keyboard glyphs synchronized with the active input hardware.
 */
export function ControllerGlyphLegend({
  items,
  rightHint,
  className,
}: ControllerGlyphLegendProps) {
  const glyphPreference = useControllerStore((s) => s.glyphPreference);
  const activeInputDevice = useControllerStore((s) => s.activeInputDevice);
  const activeControllerProfile = useControllerStore((s) => s.activeControllerProfile);

  const profile = resolveEffectiveGlyphProfile(
    glyphPreference,
    activeInputDevice,
    activeControllerProfile,
  );

  const defaultRightHint =
    profile === 'keyboard'
      ? 'Use Arrow Keys to navigate · Enter to select · F11 Fullscreen'
      : 'Use D-Pad or Left Stick to navigate · Right Stick to scroll';

  return (
    <div
      aria-label="Controller Navigation Hints"
      className={cn(
        'flex flex-wrap md:flex-nowrap items-center justify-between gap-3 text-body-sm text-muted select-none',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 min-w-0">
        {items.map((item) => (
          <span key={`${item.button}-${item.label}`} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <ControllerGlyph button={item.button} profile={profile} size="md" />
            <span className="font-medium text-on-surface/90">{item.label}</span>
          </span>
        ))}
      </div>
      <span className="hidden xl:inline text-[13px] text-muted/90 whitespace-nowrap shrink-0">
        {rightHint ?? defaultRightHint}
      </span>
    </div>
  );
}
