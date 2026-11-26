import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useControllerStore } from '@/stores/controllerStore';
import { cn } from '@/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, id, value, onChange, disabled, 'aria-label': ariaLabel, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const activeInputDevice = useControllerStore((s) => s.activeInputDevice);

    const [pickerOpen, setPickerOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const currentLabel =
      options.find((o) => o.value === String(value ?? ''))?.label ??
      options[0]?.label ??
      'Select';

    useEffect(() => {
      if (!pickerOpen) return;
      const timer = window.setTimeout(() => {
        const selectedBtn = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
        (selectedBtn ?? listRef.current?.querySelector<HTMLButtonElement>('button'))?.focus();
      }, 20);

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setPickerOpen(false);
          triggerRef.current?.focus();
        }
      };
      window.addEventListener('keydown', onKey, true);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('keydown', onKey, true);
      };
    }, [pickerOpen]);

    const emitSelectChange = (nextVal: string) => {
      if (!onChange) return;
      const syntheticEvent = {
        target: { value: nextVal, name: props.name },
        currentTarget: { value: nextVal, name: props.name },
      } as ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    };

    // Use a controller/keyboard-safe popover picker when navigated via controller or explicit trigger,
    // while keeping standard mouse <select> fast and snappy when using a mouse.
    if (activeInputDevice === 'controller') {
      return (
        <div className="flex flex-col gap-1.5">
          {label && (
            <label htmlFor={selectId} className="text-label-sm text-muted font-medium">
              {label}
            </label>
          )}
          <button
            ref={triggerRef}
            id={selectId}
            type="button"
            data-nav-item="true"
            aria-label={ariaLabel || label}
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
            className={cn(
              'relative flex w-full items-center justify-between rounded-lg bg-surface/90 border px-3 py-2 text-left text-body-md text-on-surface',
              'focus:outline-none transition-colors duration-state-change disabled:opacity-50',
              error
                ? 'border-error/80'
                : 'border-outline focus:border-accent-active hover:border-outline/95',
              className,
            )}
          >
            <span className="truncate">{currentLabel}</span>
            <ChevronDown className="h-4 w-4 text-muted shrink-0 ml-2" />
          </button>
          {error && <p className="text-body-sm text-error">{error}</p>}

          {pickerOpen &&
            createPortal(
              <div
                className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-background/80 backdrop-blur-lg"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) {
                    setPickerOpen(false);
                    triggerRef.current?.focus();
                  }
                }}
              >
                <div
                  ref={listRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={label || ariaLabel || 'Select option'}
                  className="w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden rounded-2xl border border-outline bg-secondary-background/95 shadow-modal"
                >
                  <div className="border-b border-outline/70 px-5 py-3.5 font-headline text-headline-sm text-on-background">
                    {label || ariaLabel || 'Select Option'}
                  </div>
                  <div className="overflow-y-auto p-2 space-y-1">
                    {options.map((opt) => {
                      const selected = opt.value === String(value ?? '');
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          data-nav-item="true"
                          disabled={opt.disabled}
                          onClick={() => {
                            emitSelectChange(opt.value);
                            setPickerOpen(false);
                            window.setTimeout(() => triggerRef.current?.focus(), 20);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-body-md transition-colors',
                            selected
                              ? 'bg-accent-active/20 text-on-background font-semibold border border-accent-active/50'
                              : 'text-on-surface hover:bg-surface-elevated border border-transparent',
                          )}
                        >
                          <span className="truncate">{opt.label}</span>
                          {selected && <Check className="h-4 w-4 text-accent-active shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-label-sm text-muted font-medium">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            aria-label={ariaLabel}
            value={value}
            onChange={onChange}
            disabled={disabled}
            data-nav-item="true"
            className={cn(
              'w-full appearance-none rounded-lg bg-surface/90 border px-3 py-2 pr-9 text-body-md text-on-surface',
              'focus:outline-none transition-colors duration-state-change cursor-pointer disabled:opacity-50',
              error
                ? 'border-error/80 focus:border-error'
                : 'border-outline focus:border-accent-active hover:border-outline/95',
              className,
            )}
            {...props}
          >
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-secondary-background text-on-background"
              >
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted" />
        </div>
        {error && <p className="text-body-sm text-error">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
