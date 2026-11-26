import { forwardRef, type InputHTMLAttributes } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  onValueChange: (value: string) => void;
  onClear?: () => void;
  isLoading?: boolean;
  shortcutHint?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      value,
      onValueChange,
      onClear,
      isLoading = false,
      shortcutHint,
      placeholder = 'Search games...',
      ...props
    },
    ref,
  ) => {
    return (
      <div
        className={cn(
          'relative flex items-center rounded-lg bg-surface/80 border border-outline/80',
          'focus-within:border-accent-active focus-within:bg-surface transition-all duration-state-change',
          className,
        )}
      >
        <Search className="ml-3 h-4 w-4 text-muted shrink-0 pointer-events-none" />
        <input
          ref={ref}
          type="search"
          data-nav-item="true"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent px-2.5 py-2 text-body-md text-on-surface placeholder:text-muted/60 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          {...props}
        />
        <div className="flex items-center gap-1.5 pr-2.5 shrink-0">
          {isLoading && <Loader2 className="h-3.5 w-3.5 text-accent-active animate-spin" />}
          {value.length > 0 ? (
            <button
              type="button"
              data-nav-item="true"
              aria-label="Clear search"
              onClick={() => {
                onValueChange('');
                onClear?.();
              }}
              className="rounded p-0.5 text-muted hover:text-on-background hover:bg-surface-elevated transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : shortcutHint ? (
            <kbd className="hidden sm:inline-flex items-center rounded border border-outline bg-secondary-background px-1.5 py-0.5 text-[11px] font-medium text-muted">
              {shortcutHint}
            </kbd>
          ) : null}
        </div>
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
