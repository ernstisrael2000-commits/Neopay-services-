import { Skeleton } from '../ui/skeleton';
import { TransactionListSkeleton } from './TransactionListSkeleton';

/**
 * Loading state for the affiliate home screen: fixed header, contest podium,
 * greeting, single commission wallet, stats and five bottom tabs.
 */
export function AffiliateDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50" aria-label="Chargement du tableau de bord affilié">
      <div className="fixed left-0 right-0 top-0 z-40 border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5"><Skeleton className="h-9 w-9 rounded-full" /><div className="space-y-1.5"><Skeleton className="h-3.5 w-24 rounded-full" /><Skeleton className="h-2 w-28 rounded-full" /></div></div>
          <div className="flex gap-2"><Skeleton className="h-9 w-9 rounded-xl" /><Skeleton className="h-9 w-9 rounded-xl" /></div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-28 pt-14">
        <Skeleton className="mb-4 h-36 w-full rounded-3xl" />

        <div className="space-y-4">
          <div className="flex items-center justify-between pt-1"><div className="space-y-2"><Skeleton className="h-3 w-16 rounded-full" /><Skeleton className="h-7 w-40 rounded-full" /></div><Skeleton className="h-7 w-24 rounded-full" /></div>

          <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-700 p-6 shadow-2xl">
            <div className="flex items-start justify-between"><Skeleton className="h-3 w-32 rounded-full bg-white/25" /><Skeleton className="h-7 w-7 rounded-full bg-white/15" /></div>
            <Skeleton className="mt-3 h-10 w-48 rounded-full bg-white/30" />
            <Skeleton className="mt-2 h-3 w-28 rounded-full bg-white/15" />
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4"><div className="space-y-2"><Skeleton className="h-2 w-20 rounded-full bg-white/15" /><Skeleton className="h-4 w-24 rounded-full bg-white/25" /></div><div className="space-y-2"><Skeleton className="h-2 w-16 rounded-full bg-white/15" /><Skeleton className="h-4 w-24 rounded-full bg-white/25" /></div></div>
          </div>

          <div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map(i => <div key={i} className="space-y-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><Skeleton className="h-9 w-9 rounded-xl" /><Skeleton className="h-2.5 w-20 rounded-full" /><Skeleton className="h-5 w-16 rounded-full" /></div>)}</div>

          <div className="space-y-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><Skeleton className="h-4 w-36 rounded-full" /><Skeleton className="h-3 w-16 rounded-full" /></div><Skeleton className="h-12 w-full rounded-2xl" /><Skeleton className="h-12 w-full rounded-2xl" /></div>
          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm"><div className="border-b border-gray-100 px-5 py-4"><Skeleton className="h-4 w-32 rounded-full" /></div><TransactionListSkeleton variant="affiliate" count={4} /></div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white pb-safe"><div className="mx-auto flex max-w-2xl justify-around py-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="flex flex-col items-center gap-1 py-1"><Skeleton className="h-6 w-6 rounded-lg" /><Skeleton className="h-2 w-10 rounded-full" /></div>)}</div></div>
    </div>
  );
}