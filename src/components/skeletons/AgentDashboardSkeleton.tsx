import { Skeleton } from '../ui/skeleton';
import { TransactionListSkeleton } from './TransactionListSkeleton';

/**
 * Loading state for the agent home screen. It follows the real floating wallet,
 * quick-action grid, month summary and portaled five-slot navigation.
 */
export function AgentDashboardSkeleton() {
  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]" aria-label="Chargement du tableau de bord agent">
      <header className="relative shrink-0 overflow-hidden px-6 pb-20 pt-14" style={{ background: 'linear-gradient(135deg, #0A3D91 0%, #06214D 100%)' }}>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl bg-white/20" />
            <div className="space-y-2"><Skeleton className="h-4 w-28 rounded-full bg-white/25" /><Skeleton className="h-2.5 w-36 rounded-full bg-white/15" /></div>
          </div>
          <Skeleton className="h-9 w-9 rounded-full bg-white/20" />
        </div>

        <div className="absolute bottom-[-60px] left-6 right-6 z-20 rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between">
            <div className="space-y-2"><Skeleton className="h-3 w-32 rounded-full" /><Skeleton className="h-9 w-40 rounded-full" /></div>
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <Skeleton className="mt-4 h-px w-full" />
          <div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-lg" /><div className="space-y-1.5"><Skeleton className="h-2 w-28 rounded-full" /><Skeleton className="h-3 w-16 rounded-full" /></div></div><Skeleton className="h-5 w-5 rounded-full" /></div>
        </div>
      </header>

      <main className="space-y-8 px-6 pb-36 pt-[80px]">
        {/* Contest podium */}
        <Skeleton className="h-32 w-full rounded-3xl" />

        {/* Six quick actions, as in the overview */}
        <section className="space-y-4">
          <Skeleton className="h-5 w-36 rounded-full" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="space-y-2"><Skeleton className="h-3.5 w-20 rounded-full" /><Skeleton className="h-2.5 w-24 rounded-full" /></div>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-2xl bg-amber-200" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-44 rounded-full bg-amber-200" /><Skeleton className="h-2.5 w-28 rounded-full bg-amber-100" /></div><Skeleton className="h-5 w-5 rounded-full bg-amber-200" /></div></div>

        <section className="space-y-4">
          <div className="flex items-center justify-between"><Skeleton className="h-5 w-36 rounded-full" /><Skeleton className="h-3 w-16 rounded-full" /></div>
          <div className="flex gap-4 overflow-hidden">{[1, 2, 3].map(i => <div key={i} className="min-w-[140px] space-y-2 rounded-2xl border border-slate-100 bg-white p-4"><Skeleton className="h-4 w-4 rounded" /><Skeleton className="h-2.5 w-20 rounded-full" /><Skeleton className="h-6 w-16 rounded-full" /></div>)}</div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between"><Skeleton className="h-5 w-44 rounded-full" /><Skeleton className="h-3 w-20 rounded-full" /></div>
          <TransactionListSkeleton variant="agent" count={4} />
        </section>
        <div className="flex items-center gap-4 rounded-3xl border border-blue-100 bg-blue-50/50 p-5"><Skeleton className="h-10 w-10 shrink-0 rounded-full bg-blue-200" /><div className="space-y-2"><Skeleton className="h-3.5 w-36 rounded-full" /><Skeleton className="h-2.5 w-56 rounded-full bg-blue-100" /></div></div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-white pb-safe">
        <div className="flex items-center justify-between px-6 py-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="flex flex-col items-center gap-1"><Skeleton className={`${i === 3 ? 'h-12 w-12 -mt-7 rounded-2xl' : 'h-5 w-5 rounded-lg'}`} /><Skeleton className="h-2 w-10 rounded-full" /></div>)}
        </div>
      </footer>
    </div>
  );
}