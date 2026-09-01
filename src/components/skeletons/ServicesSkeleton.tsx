import { Skeleton } from '../ui/skeleton';

/**
 * Skeleton for the ServicesView — matches the gradient header + service cards grid.
 */
export function ServicesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#f8fafc] pb-8">
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-white to-[#f8fafc] px-5 pb-8 pt-7 sm:px-8 sm:pt-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5">
          <div className="space-y-3">
            <Skeleton className="h-10 w-56 rounded-xl" />
            <Skeleton className="h-5 w-64 rounded-full" />
          </div>
          <Skeleton className="hidden h-32 w-48 rounded-[2rem] sm:block" />
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 sm:px-8">
        <div className="rounded-[1.45rem] bg-[#101d34] p-4 shadow-[0_14px_28px_rgba(15,29,52,.16)] sm:p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-white/20" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-28 rounded-full bg-white/25" />
              <Skeleton className="h-2.5 w-48 rounded-full bg-white/15" />
            </div>
            <Skeleton className="h-5 w-5 rounded-full bg-white/20" />
          </div>
          <Skeleton className="mt-3 h-9 w-full rounded-xl bg-emerald-400/70" />
        </div>

        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex min-h-[112px] w-full items-center gap-3 rounded-[1.45rem] border border-slate-100 bg-white p-3 shadow-sm sm:min-h-[120px] sm:gap-4 sm:p-4">
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 self-stretch py-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-2/3 rounded-full" />
                <Skeleton className="h-4 w-10 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full max-w-[255px] rounded-full" />
              <Skeleton className="h-3 w-28 rounded-full" />
            </div>
            <Skeleton className="h-20 w-20 shrink-0 rounded-[1.2rem]" />
          </div>
        ))}
        <div className="flex justify-center gap-5 pt-1">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-3 w-20 rounded-full" />)}
        </div>
      </div>
    </div>
  );
}
