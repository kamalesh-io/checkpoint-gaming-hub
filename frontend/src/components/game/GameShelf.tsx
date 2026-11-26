import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';

export interface GameShelfProps {
  title: string;
  subtitle?: string;
  count?: number;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  scrollStepPx?: number;
}

export function GameShelf({
  title,
  subtitle,
  count,
  headerAction,
  children,
  className,
  scrollStepPx = 560,
}: GameShelfProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({
      left: direction * scrollStepPx,
      behavior: 'smooth',
    });
  };

  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-headline text-headline-md text-on-background truncate">{title}</h2>
            {typeof count === 'number' && (
              <span className="rounded-full bg-surface-elevated border border-outline/75 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-muted">
                {count}
              </span>
            )}
          </div>
          {subtitle && <p className="text-body-sm text-muted mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {headerAction}
          <div className="hidden sm:flex items-center gap-1">
            <IconButton
              label={`Scroll ${title} left`}
              variant="surface"
              size="sm"
              onClick={() => scrollBy(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={`Scroll ${title} right`}
              variant="surface"
              size="sm"
              onClick={() => scrollBy(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto pb-2 pt-1 scroll-smooth no-scrollbar"
      >
        {children}
      </div>
    </section>
  );
}
