import { Skeleton } from '../ui/skeleton';

/**
 * Reproduces the 2-column product/game/card grid used in HomeView and ProductsView.
 * count: number of cards to show (default 6)
 */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/30">
          {/* Image area */}
          <Skeleton className="w-full h-36 rounded-none" />
          {/* Text area */}
          <div className="p-3 space-y-2">
            <Skeleton className="h-3.5 w-4/5 rounded-full" />
            <Skeleton className="h-3 w-2/5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Single row of quick-action nav buttons (horizontal scroll strip).
 */
export function NavButtonsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-x-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <Skeleton className="h-2.5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}
