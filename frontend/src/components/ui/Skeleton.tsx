import { cn } from '@/utils/cn';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('checkpoint-shimmer rounded-lg bg-surface/80', className)}
    />
  );
}

export function GameCoverSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <Skeleton className="h-4 w-4/5 rounded" />
      <Skeleton className="h-3 w-1/2 rounded" />
    </div>
  );
}

export function LandscapeCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <Skeleton className="aspect-[16/9] w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4 rounded" />
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative h-[460px] lg:h-[520px] w-full overflow-hidden rounded-2xl border border-outline/40 bg-secondary-background">
      <Skeleton className="h-full w-full rounded-none opacity-60" />
      <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10 space-y-4">
        <Skeleton className="h-6 w-36 rounded-full" />
        <Skeleton className="h-12 w-2/3 max-w-xl rounded-xl" />
        <Skeleton className="h-4 w-full max-w-lg rounded" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-11 w-40 rounded-lg" />
          <Skeleton className="h-11 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
