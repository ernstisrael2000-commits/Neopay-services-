import { Skeleton } from '../ui/skeleton';

/**
 * Full-page skeleton for the AffiliateDashboard — matches the fixed header,
 * gradient banner, stats cards, and tab navigation layout.
 */
export function AffiliateDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" aria-label="Chargement du tableau de bord affilié">
      {/* ── Fixed Header ── */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20 rounded-full" />
              <Skeleton className="h-2.5 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-[57px]" />

      {/* ── Profile banner ── */}
      <div className="bg-gradient-to-br from-primary/80 to-indigo-600/80 px-4 pt-6 pb-20">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 rounded-full bg-white/30" />
              <Skeleton className="h-3 w-24 rounded-full bg-white/20" />
            </div>
          </div>
          {/* Stats pill row */}
          <div className="flex gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-1 bg-white/15 rounded-2xl p-3 space-y-1.5">
                <Skeleton className="h-5 w-10 rounded-full bg-white/30 mx-auto" />
                <Skeleton className="h-2.5 w-14 rounded-full bg-white/20 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main card floating over banner ── */}
      <div className="max-w-2xl mx-auto px-4 -mt-12 pb-32 space-y-4">
        {/* Wallet card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-36 rounded-full" />
          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 rounded-2xl" />
            ))}
          </div>
        </div>

        {/* Recent transactions skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700/30">
            <Skeleton className="h-4 w-36 rounded-full" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 dark:border-gray-700/20 last:border-0">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/5 rounded-full" />
                <Skeleton className="h-2.5 w-1/3 rounded-full" />
              </div>
              <div className="space-y-1.5 text-right">
                <Skeleton className="h-3.5 w-16 rounded-full ml-auto" />
                <Skeleton className="h-4 w-14 rounded-full ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom tab bar skeleton ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/50 safe-area-bottom">
        <div className="flex justify-around py-2 max-w-2xl mx-auto">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col items-center gap-1 py-1">
              <Skeleton className="h-6 w-6 rounded-lg" />
              <Skeleton className="h-2 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
