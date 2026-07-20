import { Skeleton } from '../ui/skeleton';

/**
 * Generic full-page skeleton used as the Suspense fallback for lazy-loaded routes.
 * Mimics the general app layout (gradient header + content cards).
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24" aria-label="Chargement de la page">
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-primary/30 to-indigo-400/20 px-4 pt-6 pb-14">
        <div className="max-w-3xl mx-auto space-y-3">
          <Skeleton className="h-6 w-40 rounded-full bg-white/40" />
          <Skeleton className="h-3 w-64 rounded-full bg-white/30" />
        </div>
      </div>

      {/* Content cards */}
      <div className="max-w-3xl mx-auto px-4 -mt-8 space-y-4">
        {/* Large card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-5 space-y-4">
          <Skeleton className="h-5 w-32 rounded-full" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50">
                <Skeleton className="h-32 w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-4/5 rounded-full" />
                  <Skeleton className="h-2.5 w-1/2 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Secondary card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-5 space-y-3">
          <Skeleton className="h-5 w-28 rounded-full" />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/5 rounded-full" />
                <Skeleton className="h-2.5 w-1/3 rounded-full" />
              </div>
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
