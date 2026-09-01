import { Skeleton } from '../ui/skeleton';

/**
 * Reproduces the 2-column product/game/card grid used in HomeView and ProductsView.
 * count: number of cards to show (default 6)
 */
export function ProductGridSkeleton({ count = 6, featured = false }: { count?: number; featured?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/30 ${featured && i === 0 ? 'col-span-2' : ''}`}>
          {/* Image area */}
          <div className={`relative overflow-hidden ${featured && i === 0 ? 'aspect-[16/7]' : 'aspect-[4/3]'}`}>
            <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            {featured && i === 0 && (
              <div className="absolute inset-x-3 bottom-3 space-y-1.5">
                <Skeleton className="h-3.5 w-2/5 rounded-full bg-white/40" />
                <Skeleton className="h-2.5 w-1/4 rounded-full bg-white/30" />
              </div>
            )}
          </div>
          {/* Text area */}
          {!featured || i !== 0 ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-3.5 w-4/5 rounded-full" />
              <Skeleton className="h-3 w-2/5 rounded-full" />
              <Skeleton className="h-2.5 w-1/3 rounded-full" />
            </div>
          ) : null}
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
