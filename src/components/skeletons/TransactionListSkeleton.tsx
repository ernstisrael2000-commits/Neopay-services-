import { Skeleton } from '../ui/skeleton';

/**
 * Reusable transaction row skeleton — matches the layout used in
 * ClientDashboard, AffiliateDashboard, and AgentDashboard.
 */
export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-50 dark:divide-gray-700/30">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          {/* Icon bubble */}
          <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
          {/* Label + date */}
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/5 rounded-full" />
            <Skeleton className="h-2.5 w-1/4 rounded-full" />
          </div>
          {/* Amount + badge */}
          <div className="text-right space-y-1.5">
            <Skeleton className="h-3.5 w-16 rounded-full ml-auto" />
            <Skeleton className="h-4 w-14 rounded-full ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Card wrapper with header + transaction rows — used when the list
 * is inside a white card container.
 */
export function TransactionCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="rounded-3xl border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/30 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700/30 flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>
      <TransactionListSkeleton count={count} />
    </div>
  );
}
