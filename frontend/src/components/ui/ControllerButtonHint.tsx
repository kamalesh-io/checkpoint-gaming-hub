import {
  ControllerGlyph,
  type ControllerGlyphKey,
} from '@/components/controller/ControllerGlyph';
import { resolveEffectiveGlyphProfile } from '@/services/gamepad/gamepadNormalizer';
import { useControllerStore } from '@/stores/controllerStore';
import { cn } from '@/utils/cn';

export interface ControllerButtonHintProps {
  glyph: string | ControllerGlyphKey;
  label?: string;
  tone?: 'default' | 'accent';
  className?: string;
}

const KNOWN_GLYPH_KEYS = new Set<string>([
  'CONFIRM',
  'BACK',
  'QUICK_ACTION',
  'SEARCH',
  'LB',
  'RB',
  'LT',
  'RT',
  'DPAD',
  'MENU',
]);

/**
 * Dynamic spatial-navigation button / shortcut glyph badge.
 * Automatically renders Xbox, PlayStation DualSense, or Keyboard glyphs when passed a ControllerGlyphKey.
 */
export function ControllerButtonHint({
  glyph,
  label,
  tone = 'default',
  className,
}: ControllerButtonHintProps) {
  const glyphPreference = useControllerStore((s) => s.glyphPreference);
  const activeInputDevice = useControllerStore((s) => s.activeInputDevice);
  const activeControllerProfile = useControllerStore((s) => s.activeControllerProfile);

  const resolvedProfile = resolveEffectiveGlyphProfile(
    glyphPreference,
    activeInputDevice,
    activeControllerProfile,
  );

  if (KNOWN_GLYPH_KEYS.has(glyph)) {
    return (
      <span className={cn('inline-flex items-center gap-2 text-body-sm text-muted select-none', className)}>
        <ControllerGlyph button={glyph as ControllerGlyphKey} profile={resolvedProfile} />
        {label && <span className="text-on-surface/90">{label}</span>}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-body-sm text-muted select-none', className)}>
      <kbd
        className={cn(
          'inline-flex min-w-[22px] items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide',
          tone === 'accent'
            ? 'border-accent-active/50 bg-accent-active/15 text-accent-active'
            : 'border-outline bg-surface-elevated text-on-surface',
        )}
      >
        {glyph}
      </kbd>
      {label && <span>{label}</span>}
    </span>
  );
}
