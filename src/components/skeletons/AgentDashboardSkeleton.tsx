import { Skeleton } from '../ui/skeleton';

/**
 * Full-page skeleton for the AgentDashboard — matches the blue gradient header,
 * stats scroll strip, and section navigation layout.
 */
export function AgentDashboardSkeleton() {
  return (
    <div className="w-full min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-gray-900" aria-label="Chargement du tableau de bord agent">

      {/* ── Blue gradient header ── */}
      <header
        className="shrink-0 pt-14 px-6 pb-20 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A3D91 0%, #06214D 100%)' }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl bg-white/20" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-full bg-white/25" />
              <Skeleton className="h-2.5 w-36 rounded-full bg-white/15" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-full bg-white/20" />
          </div>
        </div>

        {/* Balance card */}
        <div className="bg-white/10 rounded-3xl p-5 space-y-3 relative z-10">
          <Skeleton className="h-3 w-24 rounded-full bg-white/20" />
          <Skeleton className="h-9 w-40 rounded-full bg-white/30" />
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-10 flex-1 rounded-2xl bg-white/15" />
            <Skeleton className="h-10 flex-1 rounded-2xl bg-white/15" />
          </div>
        </div>
      </header>

      {/* ── Nav section tabs ── */}
      <div className="shrink-0 px-4 -mt-6 relative z-10">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-2 flex gap-1 overflow-x-auto no-scrollbar">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-8 w-20 rounded-xl shrink-0" />
          ))}
        </div>
      </div>

      {/* ── Body content ── */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Monthly stats strip */}
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {[1, 2, 3].map(i => (
            <div key={i} className="min-w-[140px] bg-white dark:bg-gray-800 rounded-2xl p-4 space-y-2 border border-gray-100 dark:border-gray-700/50 shrink-0">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-2.5 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>

        {/* Recent transactions */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm space-y-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700/30 flex items-center justify-between">
            <Skeleton className="h-4 w-36 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-700/20 last:border-0">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/5 rounded-full" />
                <Skeleton className="h-2.5 w-1/3 rounded-full" />
              </div>
              <div className="text-right space-y-1.5">
                <Skeleton className="h-4 w-20 rounded-full ml-auto" />
                <Skeleton className="h-2.5 w-12 rounded-full ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
