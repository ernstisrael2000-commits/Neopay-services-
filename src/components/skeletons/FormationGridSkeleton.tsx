import { Skeleton } from '../ui/skeleton';

/**
 * Reproduces the 2-column formation card grid in FormationsView.
 */
export function FormationGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-stone-200/80 bg-white shadow-sm">
          {/* Thumbnail */}
          <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
            <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            <Skeleton className="absolute top-2.5 left-2.5 h-5 w-14 rounded-full bg-white/55" />
            <Skeleton className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full bg-black/15" />
          </div>
          {/* Meta */}
          <div className="p-2.5 sm:p-3 space-y-1.5">
            <Skeleton className="h-2 w-16 rounded-full bg-orange-100" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
            <Skeleton className="h-2.5 w-3/5 rounded-full" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-2.5 w-1/3 rounded-full" />
              <Skeleton className="h-2.5 w-1/4 rounded-full" />
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
        <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50 bg-white">
          <div className="relative aspect-[16/9] overflow-hidden">
            <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            <Skeleton className="absolute top-2 left-2 h-4 w-12 rounded-full bg-white/45" />
            <Skeleton className="absolute bottom-2 left-2 h-2.5 w-3/5 rounded-full bg-white/35" />
          </div>
          <div className="p-2.5 space-y-1.5">
            <Skeleton className="h-2 w-14 rounded-full bg-orange-100" />
            <Skeleton className="h-3 w-3/4 rounded-full" />
            <Skeleton className="h-2.5 w-1/2 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
