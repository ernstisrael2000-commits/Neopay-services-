import { Skeleton } from '../ui/skeleton';
import { TransactionListSkeleton } from './TransactionListSkeleton';

/**
 * Full skeleton for the ClientDashboard — matches the virtual card,
 * balance strip, action buttons, and transaction list layout.
 */
export function ClientDashboardSkeleton() {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900" aria-label="Chargement du tableau de bord">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 shrink-0">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Virtual card skeleton — matches aspect-ratio 1.75/1 */}
      <div className="px-3 pb-2 shrink-0 pt-3">
        <Skeleton
          className="w-full rounded-[1.75rem]"
          style={{ aspectRatio: '1.75 / 1' }}
        />

        {/* Balance strip */}
        <div className="mt-2 grid grid-cols-3 gap-2 px-1">
          {[1, 2, 3].map(i => (
            <div key={i} className={`space-y-1.5 ${i === 3 ? 'text-right' : ''}`}>
              <Skeleton className={`h-2.5 rounded-full ${i === 3 ? 'w-10 ml-auto' : 'w-16'}`} />
              <Skeleton className={`h-5 rounded-full ${i === 3 ? 'w-16 ml-auto' : 'w-20'}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-hidden px-3 pb-3 space-y-2.5 pt-2">
        {/* Action buttons row (Dépôt / Retrait) */}
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>

        {/* Transfer button */}
        <Skeleton className="h-14 w-full rounded-2xl" />

        {/* Recent transactions */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/30 overflow-hidden">
          <div className="h-9 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700/40 flex items-center px-4">
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
          <TransactionListSkeleton count={3} />
        </div>
      </div>
    </div>
  );
}
