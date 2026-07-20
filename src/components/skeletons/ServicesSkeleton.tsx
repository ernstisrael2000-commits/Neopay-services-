import { Skeleton } from '../ui/skeleton';

/**
 * Skeleton for the ServicesView — matches the gradient header + service cards grid.
 */
export function ServicesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl bg-white dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700/50 shadow-sm p-5 flex items-center gap-4"
        >
          {/* Icon */}
          <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
          {/* Title + description */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3 rounded-full" />
            <Skeleton className="h-3 w-3/4 rounded-full" />
          </div>
          {/* Arrow */}
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}
