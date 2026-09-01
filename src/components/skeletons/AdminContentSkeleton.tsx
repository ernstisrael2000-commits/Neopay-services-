import { Skeleton } from '../ui/skeleton';

type AdminContentSkeletonProps = {
  variant?: 'table' | 'list' | 'cards' | 'gallery' | 'stats';
  rows?: number;
};

/**
 * Shared admin loading shapes. Admin sections keep their own headings and
 * filters; this component fills the content area with the same density as the
 * tables, cards and galleries that will replace it.
 */
export function AdminContentSkeleton({ variant = 'table', rows = 5 }: AdminContentSkeletonProps) {
  if (variant === 'stats') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><Skeleton className="h-3 w-20 rounded-full" /><Skeleton className="mt-3 h-7 w-24 rounded-full" /><Skeleton className="mt-2 h-2.5 w-16 rounded-full" /></div>)}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><Skeleton className="h-4 w-40 rounded-full" /><div className="mt-5 flex h-44 items-end gap-3">{[40, 65, 50, 82, 58, 72, 48].map((height, i) => <Skeleton key={i} className="flex-1 rounded-t-xl" style={{ height: `${height}%` }} />)}</div></div>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: Math.max(rows, 6) }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3 rounded-full" /><Skeleton className="h-2.5 w-1/2 rounded-full" /></div></div>
            <Skeleton className="mt-4 h-2.5 w-4/5 rounded-full" /><Skeleton className="mt-2 h-2.5 w-3/5 rounded-full" />
            <div className="mt-4 flex gap-2"><Skeleton className="h-8 flex-1 rounded-lg" /><Skeleton className="h-8 w-20 rounded-lg" /></div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'gallery') {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: Math.max(rows, 6) }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"><Skeleton className="aspect-video h-auto w-full rounded-none" /><div className="space-y-2 p-3"><Skeleton className="h-3.5 w-4/5 rounded-full" /><Skeleton className="h-2.5 w-1/2 rounded-full" /><Skeleton className="h-8 w-full rounded-lg" /></div></div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className={`${i === 1 ? 'w-2/5' : 'w-1/6'} h-3 rounded-full`} />)}</div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-gray-50 px-4 py-4 last:border-0">
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5 rounded-full" /><Skeleton className="h-2.5 w-1/3 rounded-full" /></div>
          <Skeleton className="hidden h-3 w-1/6 rounded-full sm:block" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}