import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  formatDisplayDate,
  MONTH_NAMES,
  parseIsoDate,
  toIsoDate,
  WEEKDAY_NAMES,
} from '@/utils/date';

export { formatDisplayDate, parseIsoDate, toIsoDate };

export interface DatePickerProps {
  label?: string;
  value?: string | null; // ISO string format YYYY-MM-DD
  onChange: (date: string | null) => void;
  minDate?: string | null; // ISO YYYY-MM-DD
  maxDate?: string | null; // ISO YYYY-MM-DD
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'dd-mm-yyyy',
  disabled = false,
  error,
  className,
}: DatePickerProps) {
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  // Parse current selected date
  const parsedValue = useMemo(() => parseIsoDate(value), [value]);

  // Track the view month & year currently displayed in the calendar
  const today = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, []);

  const [viewYear, setViewYear] = useState<number>(parsedValue?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState<number>(parsedValue?.month ?? today.month);

  // Sync view when value changes from outside
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }
  }, [value, parsedValue]);

  // Close calendar popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Compute days in month and starting day offset (Monday = 0, Sunday = 6)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // getDay returns 0 for Sunday. Convert to Monday=0, Sunday=6
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      iso: string;
      disabled: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Previous month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const iso = toIsoDate(y, m, d);
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        iso,
        disabled: true,
        isToday: false,
        isSelected: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const iso = toIsoDate(viewYear, viewMonth, d);
      let isDisabled = false;
      if (minDate && iso < minDate) isDisabled = true;
      if (maxDate && iso > maxDate) isDisabled = true;

      const isToday =
        today.year === viewYear && today.month === viewMonth && today.day === d;
      const isSelected =
        Boolean(parsedValue &&
        parsedValue.year === viewYear &&
        parsedValue.month === viewMonth &&
        parsedValue.day === d);

      days.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        iso,
        disabled: isDisabled,
        isToday,
        isSelected,
      });
    }

    // Next month padding to fill a complete 7-day grid row
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      const iso = toIsoDate(y, m, d);
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        iso,
        disabled: true,
        isToday: false,
        isSelected: false,
      });
    }

    return days;
  }, [viewYear, viewMonth, minDate, maxDate, today, parsedValue]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectToday = () => {
    const todayIso = toIsoDate(today.year, today.month, today.day);
    if ((minDate && todayIso < minDate) || (maxDate && todayIso > maxDate)) {
      return;
    }
    setViewYear(today.year);
    setViewMonth(today.month);
    onChange(todayIso);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative flex flex-col space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-label-sm font-medium text-muted transition-colors"
        >
          {label}
        </label>
      )}

      {/* Interactive Display Button Trigger */}
      <div className="relative flex items-center">
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          data-nav-item="true"
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-xl border px-3.5 text-left text-body-sm transition-all outline-none',
            'bg-surface/80 border-outline text-on-surface focus:border-accent focus:ring-1 focus:ring-accent/40',
            disabled && 'opacity-50 cursor-not-allowed',
            error && 'border-danger focus:border-danger focus:ring-danger/30',
          )}
        >
          <span className="flex items-center gap-2.5 truncate">
            <CalendarIcon className="h-4 w-4 text-accent shrink-0" />
            <span className={cn(value ? 'text-on-surface font-medium' : 'text-muted')}>
              {value ? formatDisplayDate(value) : placeholder}
            </span>
          </span>

          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              title="Clear date"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  handleClear();
                }
              }}
              className="p-1 rounded-md text-muted hover:text-on-surface hover:bg-surface transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </div>

      {error && <span className="text-caption text-danger">{error}</span>}

      {/* Floating Calendar Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Date Picker Calendar"
          className="absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl border border-outline/70 bg-[#161D2B]/98 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {/* Calendar Header with Month/Year Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-outline/40">
            <button
              type="button"
              data-nav-item="true"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline/50 bg-surface/50 text-muted hover:text-on-surface hover:bg-surface transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-body-sm font-semibold text-on-surface">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>

            <button
              type="button"
              data-nav-item="true"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline/50 bg-surface/50 text-muted hover:text-on-surface hover:bg-surface transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 pt-3 pb-1 text-center">
            {WEEKDAY_NAMES.map((w) => (
              <span key={w} className="text-[11px] font-semibold text-muted/70 uppercase">
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, idx) => {
              if (!item.isCurrentMonth) {
                return (
                  <div
                    key={idx}
                    className="flex h-8 w-8 items-center justify-center text-caption text-muted/25"
                  >
                    {item.day}
                  </div>
                );
              }

              return (
                <button
                  key={idx}
                  type="button"
                  data-nav-item="true"
                  disabled={item.disabled}
                  onClick={() => {
                    onChange(item.iso);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-body-sm transition-all',
                    item.isSelected
                      ? 'bg-accent text-on-accent font-semibold shadow-md'
                      : item.isToday
                        ? 'border border-accent/60 text-accent font-semibold hover:bg-accent/15'
                        : item.disabled
                          ? 'text-muted/30 cursor-not-allowed'
                          : 'text-on-surface hover:bg-surface/80',
                  )}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Footer Shortcuts */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-outline/40">
            <button
              type="button"
              data-nav-item="true"
              onClick={handleSelectToday}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption text-accent hover:bg-accent/10 transition-colors font-medium"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Today</span>
            </button>

            {value && (
              <button
                type="button"
                data-nav-item="true"
                onClick={handleClear}
                className="px-2.5 py-1 rounded-lg text-caption text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
