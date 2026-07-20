import { Skeleton } from '../ui/skeleton';

/**
 * Reproduces the 2-column formation card grid in FormationsView.
 */
export function FormationGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/30 shadow-sm">
          {/* Thumbnail */}
          <Skeleton className="w-full h-32 rounded-none" />
          {/* Meta */}
          <div className="p-2.5 space-y-2">
            <Skeleton className="h-3 w-4/5 rounded-full" />
            <Skeleton className="h-2.5 w-3/5 rounded-full" />
            {/* Price + level badge row */}
            <div className="flex items-center justify-between pt-0.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Hero stats bar above the formation grid.
 */
export function FormationStatsSkeleton() {
  return (
    <div className="flex gap-3 mb-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex-1 bg-white dark:bg-gray-800/30 rounded-2xl p-3 border border-gray-100 dark:border-gray-700/50 space-y-1.5">
          <Skeleton className="h-5 w-8 rounded-full mx-auto" />
          <Skeleton className="h-2.5 w-14 rounded-full mx-auto" />
        </div>
      ))}
    </div>
  );
}

/**
 * Mini 2-card formation strip used inside HomeView.
 */
export function FormationMiniSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="p-2.5 space-y-1.5">
            <Skeleton className="h-3 w-3/4 rounded-full" />
            <Skeleton className="h-2.5 w-1/2 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
