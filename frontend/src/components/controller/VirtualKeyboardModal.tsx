import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Delete, RotateCcw, Space, X } from 'lucide-react';
import { ControllerGlyph } from '@/components/controller/ControllerGlyph';
import { Button } from '@/components/ui/Button';
import { CONTROLLER_CUSTOM_EVENT } from '@/hooks/useSpatialNavigation';
import { resolveEffectiveGlyphProfile } from '@/services/gamepad/gamepadNormalizer';
import type { ControllerActionEvent } from '@/services/gamepad/types';
import { useControllerStore, type VirtualKeyboardSession } from '@/stores/controllerStore';
import { cn } from '@/utils/cn';

type KeyboardLayer = 'lower' | 'upper' | 'symbols';

const ROWS_LOWER = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '-'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', ':', '!'],
];

const ROWS_UPPER = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '_'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', ';', '?'],
];

const ROWS_SYMBOLS = [
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['-', '_', '+', '=', '[', ']', '{', '}', '/', '\\'],
  [':', ';', '"', "'", '<', '>', '|', '~', '`', '?'],
  ['.', ',', '&', 'II', 'III', 'IV', 'HD', '2025', '2026', 'RPG'],
];

function VirtualKeyboardInner({
  session,
  onClose,
}: {
  session: VirtualKeyboardSession;
  onClose: () => void;
}) {
  const glyphPreference = useControllerStore((s) => s.glyphPreference);
  const activeInputDevice = useControllerStore((s) => s.activeInputDevice);
  const activeControllerProfile = useControllerStore((s) => s.activeControllerProfile);

  const [draft, setDraft] = useState(session.initialValue ?? '');
  const [layer, setLayer] = useState<KeyboardLayer>('lower');
  const firstKeyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      firstKeyRef.current?.focus();
    }, 30);
    return () => {
      window.clearTimeout(timer);
      session.targetElement?.focus?.();
    };
  }, [session]);

  const glyphProfile = useMemo(
    () =>
      resolveEffectiveGlyphProfile(
        glyphPreference,
        activeInputDevice,
        activeControllerProfile,
      ),
    [glyphPreference, activeInputDevice, activeControllerProfile],
  );

  const rows = layer === 'lower' ? ROWS_LOWER : layer === 'upper' ? ROWS_UPPER : ROWS_SYMBOLS;
  const draftRef = useRef(session.initialValue ?? '');

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const commitDraft = (next: string) => {
    if (session.maxLength && next.length > session.maxLength) return;
    draftRef.current = next;
    setDraft(next);
    session.onChange?.(next);
  };

  const appendText = (token: string) => {
    commitDraft(draftRef.current + token);
  };

  const handleBackspace = () => {
    commitDraft(draftRef.current.slice(0, -1));
  };

  const handleClear = () => {
    draftRef.current = '';
    setDraft('');
    session.onChange?.('');
  };

  const handleConfirm = () => {
    const value = draftRef.current;
    onClose();
    session.onSubmit(value);
  };

  useEffect(() => {
    const onControllerAction = (ev: Event) => {
      const detail = (ev as CustomEvent<ControllerActionEvent>).detail;
      if (!detail) return;

      if (detail.action === 'QUICK_ACTION') {
        ev.preventDefault();
        const next = draftRef.current.slice(0, -1);
        draftRef.current = next;
        setDraft(next);
        session.onChange?.(next);
      } else if (detail.action === 'SEARCH') {
        ev.preventDefault();
        const next = draftRef.current + ' ';
        if (!session.maxLength || next.length <= session.maxLength) {
          draftRef.current = next;
          setDraft(next);
          session.onChange?.(next);
        }
      } else if (detail.action === 'MENU') {
        ev.preventDefault();
        onClose();
        session.onSubmit(draftRef.current);
      } else if (detail.action === 'BACK') {
        ev.preventDefault();
        onClose();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        onClose();
        session.onSubmit(draftRef.current);
      }
    };

    window.addEventListener(CONTROLLER_CUSTOM_EVENT, onControllerAction);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener(CONTROLLER_CUSTOM_EVENT, onControllerAction);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onClose, session]);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 sm:p-8 bg-background/85 backdrop-blur-xl animate-in fade-in duration-150"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Virtual Keyboard: ${session.label}`}
        className="w-full max-w-4xl rounded-2xl border border-outline bg-secondary-background/95 shadow-modal p-5 sm:p-7 space-y-5"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-active">
                On-Screen Keyboard
              </span>
              <h2 className="font-headline text-headline-md text-on-background">
                {session.label}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              data-nav-group="osk"
              onClick={onClose}
              leftIcon={<X className="h-4 w-4" />}
            >
              Cancel
            </Button>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-accent-active/45 bg-background/90 px-4 py-3.5">
            <input
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                session.onChange?.(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              placeholder={session.placeholder || 'Type with controller or physical keyboard...'}
              aria-label="Virtual keyboard input preview"
              className="flex-1 bg-transparent font-headline text-headline-sm text-on-background placeholder:text-muted/55 focus:outline-none selectable-text"
            />
            <span className="text-body-sm tabular-nums text-muted shrink-0">
              {draft.length} chars
            </span>
          </div>
        </div>

        <div className="space-y-2" data-nav-group="osk">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-10 gap-2">
              {row.map((char, colIdx) => (
                <button
                  key={`${rowIdx}-${colIdx}-${char}`}
                  ref={rowIdx === 1 && colIdx === 0 ? firstKeyRef : undefined}
                  type="button"
                  data-nav-item="true"
                  data-nav-group="osk"
                  data-nav-id={`osk-key-${rowIdx}-${colIdx}`}
                  onClick={() => appendText(char)}
                  className={cn(
                    'flex h-12 items-center justify-center rounded-xl border border-outline/80 bg-surface/85',
                    'font-headline text-headline-sm text-on-background transition-transform duration-100',
                    'hover:border-accent-active/70 hover:bg-surface-elevated active:scale-95',
                  )}
                >
                  {char}
                </button>
              ))}
            </div>
          ))}

          <div className="grid grid-cols-10 gap-2 pt-1">
            <button
              type="button"
              data-nav-item="true"
              data-nav-group="osk"
              onClick={() => setLayer((l) => (l === 'lower' ? 'upper' : 'lower'))}
              className={cn(
                'col-span-2 flex h-12 items-center justify-center rounded-xl border font-label text-label-md transition-colors',
                layer === 'upper'
                  ? 'border-accent-active bg-accent-active/20 text-on-background font-semibold'
                  : 'border-outline/80 bg-surface-elevated/85 text-muted hover:text-on-background',
              )}
            >
              {layer === 'upper' ? 'CAPS ON' : 'Shift'}
            </button>

            <button
              type="button"
              data-nav-item="true"
              data-nav-group="osk"
              onClick={() => setLayer((l) => (l === 'symbols' ? 'lower' : 'symbols'))}
              className={cn(
                'col-span-1 flex h-12 items-center justify-center rounded-xl border font-label text-label-md transition-colors',
                layer === 'symbols'
                  ? 'border-accent-active bg-accent-active/20 text-on-background font-semibold'
                  : 'border-outline/80 bg-surface-elevated/85 text-muted hover:text-on-background',
              )}
            >
              !@#
            </button>

            <button
              type="button"
              data-nav-item="true"
              data-nav-group="osk"
              onClick={() => appendText(' ')}
              className="col-span-3 flex h-12 items-center justify-center gap-2 rounded-xl border border-outline/80 bg-surface/85 font-label text-label-md text-on-surface hover:bg-surface-elevated"
            >
              <Space className="h-4 w-4" />
              <span>Space</span>
            </button>

            <button
              type="button"
              data-nav-item="true"
              data-nav-group="osk"
              onClick={handleBackspace}
              className="col-span-1 flex h-12 items-center justify-center rounded-xl border border-outline/80 bg-surface-elevated/85 text-on-surface hover:border-warning/70"
              aria-label="Backspace"
            >
              <Delete className="h-4 w-4" />
            </button>

            <button
              type="button"
              data-nav-item="true"
              data-nav-group="osk"
              onClick={handleClear}
              className="col-span-1 flex h-12 items-center justify-center rounded-xl border border-outline/80 bg-surface-elevated/85 text-muted hover:text-on-surface"
              aria-label="Clear text"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              data-nav-item="true"
              data-nav-group="osk"
              onClick={handleConfirm}
              className="col-span-2 flex h-12 items-center justify-center gap-1.5 rounded-xl border border-transparent bg-accent-active font-label text-label-md font-semibold text-on-accent-active hover:brightness-110"
            >
              <Check className="h-4 w-4" />
              <span>Confirm</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-outline/65 pt-3 text-body-sm text-muted">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <ControllerGlyph button="CONFIRM" profile={glyphProfile} /> Type Key
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ControllerGlyph button="QUICK_ACTION" profile={glyphProfile} /> Backspace
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ControllerGlyph button="SEARCH" profile={glyphProfile} /> Space
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ControllerGlyph button="MENU" profile={glyphProfile} /> Confirm
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ControllerGlyph button="BACK" profile={glyphProfile} /> Close
            </span>
          </div>
          <span>Physical keyboard typing is always active</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function VirtualKeyboardModal() {
  const session = useControllerStore((s) => s.oskSession);
  const closeVirtualKeyboard = useControllerStore((s) => s.closeVirtualKeyboard);

  if (!session) return null;
  return (
    <VirtualKeyboardInner
      key={`${session.id}-${session.initialValue}`}
      session={session}
      onClose={closeVirtualKeyboard}
    />
  );
}
