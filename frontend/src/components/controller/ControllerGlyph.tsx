import { cn } from '@/utils/cn';

export type ControllerGlyphKey =
  | 'CONFIRM'
  | 'BACK'
  | 'QUICK_ACTION'
  | 'SEARCH'
  | 'LB'
  | 'RB'
  | 'LT'
  | 'RT'
  | 'DPAD'
  | 'MENU';

export interface ControllerGlyphProps {
  button: ControllerGlyphKey;
  profile: 'xbox' | 'playstation' | 'keyboard';
  size?: 'sm' | 'md';
  className?: string;
}

const KEYBOARD_LABELS: Record<ControllerGlyphKey, string> = {
  CONFIRM: 'Enter',
  BACK: 'Esc',
  QUICK_ACTION: 'Menu',
  SEARCH: 'Ctrl+K',
  LB: 'Shift+Tab',
  RB: 'Tab',
  LT: 'PgUp',
  RT: 'PgDn',
  DPAD: 'Arrows',
  MENU: 'F11',
};

const XBOX_STYLES: Record<ControllerGlyphKey, { label: string; colorClass: string }> = {
  CONFIRM: { label: 'A', colorClass: 'border-success/70 bg-success/20 text-success' },
  BACK: { label: 'B', colorClass: 'border-error/70 bg-error/20 text-error' },
  QUICK_ACTION: { label: 'X', colorClass: 'border-primary/70 bg-primary/20 text-primary' },
  SEARCH: { label: 'Y', colorClass: 'border-warning/70 bg-warning/20 text-warning' },
  LB: { label: 'LB', colorClass: 'border-outline bg-surface-elevated text-on-surface' },
  RB: { label: 'RB', colorClass: 'border-outline bg-surface-elevated text-on-surface' },
  LT: { label: 'LT', colorClass: 'border-outline bg-surface-elevated text-on-surface' },
  RT: { label: 'RT', colorClass: 'border-outline bg-surface-elevated text-on-surface' },
  DPAD: { label: 'D-Pad', colorClass: 'border-outline bg-surface-elevated text-on-surface' },
  MENU: { label: 'Menu', colorClass: 'border-outline bg-surface-elevated text-on-surface' },
};

const PS_NON_FACE_LABELS: Partial<Record<ControllerGlyphKey, string>> = {
  LB: 'L1',
  RB: 'R1',
  LT: 'L2',
  RT: 'R2',
  DPAD: 'D-Pad',
  MENU: 'Options',
};

function PlayStationFaceSvg({ button, size }: { button: ControllerGlyphKey; size: 'sm' | 'md' }) {
  const iconDim = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  if (button === 'CONFIRM') {
    // Blue Cross
    return (
      <svg viewBox="0 0 16 16" className={cn(iconDim, 'text-[#66B8FF]')} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    );
  }
  if (button === 'BACK') {
    // Red Circle
    return (
      <svg viewBox="0 0 16 16" className={cn(iconDim, 'text-[#F16D7A]')} fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="8" cy="8" r="4.8" />
      </svg>
    );
  }
  if (button === 'QUICK_ACTION') {
    // Pink/Magenta Square
    return (
      <svg viewBox="0 0 16 16" className={cn(iconDim, 'text-[#F472B6]')} fill="none" stroke="currentColor" strokeWidth="2.2">
        <rect x="3.8" y="3.8" width="8.4" height="8.4" rx="1" />
      </svg>
    );
  }
  // Green Triangle
  return (
    <svg viewBox="0 0 16 16" className={cn(iconDim, 'text-[#52D6A0]')} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <polygon points="8,3.2 12.8,12 3.2,12" />
    </svg>
  );
}

/** Hardware-authentic vector glyph pill for Xbox, PlayStation DualSense, or Keyboard shortcuts. */
export function ControllerGlyph({ button, profile, size = 'sm', className }: ControllerGlyphProps) {
  const isFace =
    button === 'CONFIRM' ||
    button === 'BACK' ||
    button === 'QUICK_ACTION' ||
    button === 'SEARCH';

  if (profile === 'keyboard') {
    return (
      <kbd
        className={cn(
          'inline-flex items-center justify-center rounded-md border border-outline bg-surface-elevated font-semibold tracking-wide text-on-surface select-none',
          size === 'sm' ? 'min-w-[24px] px-1.5 py-0.5 text-[11px]' : 'min-w-[28px] px-2 py-0.5 text-[12px]',
          className,
        )}
      >
        {KEYBOARD_LABELS[button]}
      </kbd>
    );
  }

  if (profile === 'playstation') {
    if (isFace) {
      return (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full border border-outline/90 bg-surface-elevated select-none',
            size === 'sm' ? 'h-6 w-6' : 'h-7 w-7',
            className,
          )}
        >
          <PlayStationFaceSvg button={button} size={size} />
        </span>
      );
    }
    return (
      <kbd
        className={cn(
          'inline-flex items-center justify-center rounded-md border border-outline bg-surface-elevated font-semibold text-on-surface select-none',
          size === 'sm' ? 'min-w-[26px] px-1.5 py-0.5 text-[11px]' : 'min-w-[30px] px-2 py-0.5 text-[12px]',
          className,
        )}
      >
        {PS_NON_FACE_LABELS[button] ?? button}
      </kbd>
    );
  }

  const xbox = XBOX_STYLES[button];
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center border font-bold tracking-wide select-none',
        isFace ? 'rounded-full' : 'rounded-md',
        size === 'sm'
          ? isFace
            ? 'h-6 w-6 text-[11px]'
            : 'min-w-[26px] px-1.5 py-0.5 text-[11px]'
          : isFace
            ? 'h-7 w-7 text-[12px]'
            : 'min-w-[30px] px-2 py-0.5 text-[12px]',
        xbox.colorClass,
        className,
      )}
    >
      {xbox.label}
    </kbd>
  );
}
