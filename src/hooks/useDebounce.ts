/**
 * useDebounce — delays a value update until the user stops typing.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchQuery, 350);
 *   useEffect(() => { fetchResults(debouncedSearch); }, [debouncedSearch]);
 *
 * Reduces Firestore reads and API calls from search inputs.
 */
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * debounce — wraps a function so it only fires after `wait` ms of silence.
 * Useful for event handlers outside of React hooks.
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, wait = 350): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
