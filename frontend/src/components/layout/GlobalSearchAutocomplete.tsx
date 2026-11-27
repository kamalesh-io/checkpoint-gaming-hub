import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Gamepad2, Loader2, Search, Star, ArrowRight } from 'lucide-react';
import { SearchInput } from '@/components/ui/SearchInput';
import { useIgdbSearchQuery } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { buildGameDetailsRoute, ROUTES } from '@/routes/routes';
import type { IGDBSearchResultItem } from '@/types';
import { cn } from '@/utils/cn';
import { formatIgdbRating } from '@/utils/format';

interface GlobalSearchAutocompleteProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: (finalQuery: string) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}

export function GlobalSearchAutocomplete({
  query,
  onQueryChange,
  onSubmit,
  searchRef,
  className,
}: GlobalSearchAutocompleteProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebounce(query.trim(), 300);
  const isSearchActive = debouncedQuery.length >= 2;

  const searchQuery = useIgdbSearchQuery(debouncedQuery, 8);
  const results = searchQuery.data?.data ?? [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (item: IGDBSearchResultItem) => {
    setIsOpen(false);
    setActiveIndex(-1);
    if (item.in_library && item.library_entry_id) {
      navigate(buildGameDetailsRoute(item.library_entry_id));
    } else {
      navigate(`${ROUTES.DISCOVER}?q=${encodeURIComponent(item.title)}`);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && e.key === 'ArrowDown' && isSearchActive) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        handleSelectResult(results[activeIndex]);
      } else {
        setIsOpen(false);
        setActiveIndex(-1);
        onSubmit(query.trim());
      }
    }
  };

  const handleInputChange = (val: string) => {
    onQueryChange(val);
    if (val.trim().length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleInputFocus = () => {
    if (query.trim().length >= 2) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <SearchInput
        ref={searchRef}
        value={query}
        onValueChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder="Search IGDB or jump to Discover..."
        shortcutHint="Ctrl+K"
        aria-label="Global game search"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="h-9 bg-background/70"
      />

      {isOpen && isSearchActive && (
        <div
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 overflow-hidden rounded-xl border border-outline/70 bg-[#161D2B]/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header indicator / live count */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-outline/40 bg-surface/30 text-caption text-muted">
            <span className="flex items-center gap-1.5">
              <Search className="h-3 w-3 text-accent" />
              <span>Matching Games</span>
            </span>
            {searchQuery.isFetching ? (
              <span className="flex items-center gap-1 text-accent animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Searching...</span>
              </span>
            ) : (
              <span>{results.length} found</span>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-outline/30">
            {searchQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2.5 py-6 text-body-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span>Searching IGDB catalog...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((item, idx) => {
                const isSelected = activeIndex === idx;
                return (
                  <div
                    key={item.igdb_id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectResult(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors select-none',
                      isSelected
                        ? 'bg-accent/20 border-l-2 border-accent text-on-surface'
                        : 'hover:bg-surface/50 text-on-surface/90',
                    )}
                  >
                    {/* Cover Thumbnail */}
                    <div className="relative h-11 w-8 shrink-0 overflow-hidden rounded bg-surface/80 border border-outline/40">
                      {item.cover_url ? (
                        <img
                          src={item.cover_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted">
                          <Gamepad2 className="h-4 w-4 opacity-40" />
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-body-sm font-medium truncate text-on-surface">
                          {item.title}
                        </span>
                        {item.in_library && (
                          <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-success/15 border border-success/30 px-1.5 py-0.2 text-[10px] font-medium text-success">
                            <Check className="h-2.5 w-2.5" />
                            In Library
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 mt-0.5 text-caption text-muted">
                        <span>{item.release_year ?? 'TBA'}</span>
                        {typeof item.igdb_rating === 'number' && item.igdb_rating > 0 && (
                          <span className="flex items-center gap-1 text-warning">
                            <Star className="h-2.5 w-2.5 fill-current" />
                            <span>{formatIgdbRating(item.igdb_rating)}</span>
                          </span>
                        )}
                        {item.genres?.length > 0 && (
                          <span className="truncate hidden sm:inline opacity-75">
                            • {item.genres.slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 px-4 text-center">
                <p className="text-body-sm text-muted">No games found for &ldquo;{query}&rdquo;</p>
                <p className="text-caption text-muted/70 mt-1">Press Enter to view on Discover page</p>
              </div>
            )}
          </div>

          {/* Footer CTA: Press Enter to see all */}
          <div
            onClick={() => {
              setIsOpen(false);
              onSubmit(query.trim());
            }}
            className="flex items-center justify-between px-3 py-2 bg-surface/50 border-t border-outline/40 hover:bg-surface/80 cursor-pointer text-caption text-muted hover:text-on-surface transition-colors"
          >
            <span>Search all IGDB titles on Discover</span>
            <span className="flex items-center gap-1 text-accent font-medium">
              <span>Press Enter</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
