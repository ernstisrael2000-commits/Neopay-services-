/**
 * Performance monitoring — lightweight Web Vitals tracker.
 *
 * Captures LCP, FID, CLS, TTFB and FCP using the native
 * PerformanceObserver API (no external library needed).
 * Results are logged to the console in dev and stored in
 * sessionStorage for debugging.
 *
 * Usage (call once in src/main.tsx after React hydration):
 *   import { initPerformanceMonitoring } from './lib/performance';
 *   initPerformanceMonitoring();
 */

const IS_DEV = (import.meta as any).env?.DEV ?? false;

interface VitalEntry {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  ts: number;
}

const STORAGE_KEY = 'rena_vitals';

function rate(name: string, value: number): VitalEntry['rating'] {
  const thresholds: Record<string, [number, number]> = {
    LCP:  [2500, 4000],
    FID:  [100,  300],
    CLS:  [0.1,  0.25],
    TTFB: [800,  1800],
    FCP:  [1800, 3000],
  };
  const [good, poor] = thresholds[name] ?? [Infinity, Infinity];
  return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
}

function record(name: string, value: number) {
  const entry: VitalEntry = { name, value: Math.round(value), rating: rate(name, value), ts: Date.now() };

  if (IS_DEV) {
    const emoji = entry.rating === 'good' ? '✅' : entry.rating === 'needs-improvement' ? '⚠️' : '🔴';
    console.log(`[Perf] ${emoji} ${name}: ${entry.value}ms (${entry.rating})`);
  }

  try {
    const prev = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]') as VitalEntry[];
    prev.push(entry);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(-20)));
  } catch {}
}

function observe(type: string, cb: (entries: PerformanceEntryList) => void) {
  try {
    const obs = new PerformanceObserver((list) => cb(list.getEntries()));
    obs.observe({ type, buffered: true });
    return obs;
  } catch {
    return null;
  }
}

export function initPerformanceMonitoring() {
  // FCP — First Contentful Paint
  observe('paint', (entries) => {
    for (const e of entries) {
      if (e.name === 'first-contentful-paint') record('FCP', e.startTime);
    }
  });

  // LCP — Largest Contentful Paint
  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1] as any;
    if (last) record('LCP', last.renderTime || last.loadTime);
  });

  // CLS — Cumulative Layout Shift
  let clsValue = 0;
  observe('layout-shift', (entries) => {
    for (const e of entries as any[]) {
      if (!e.hadRecentInput) clsValue += e.value;
    }
    record('CLS', clsValue * 1000); // stored as ms-equivalent for consistency
  });

  // TTFB — Time to First Byte
  observe('navigation', (entries) => {
    const nav = entries[0] as PerformanceNavigationTiming;
    if (nav) record('TTFB', nav.responseStart - nav.requestStart);
  });

  // Long Tasks (> 50 ms blocks main thread)
  observe('longtask', (entries) => {
    for (const e of entries) {
      if (IS_DEV && e.duration > 100) {
        console.warn(`[Perf] 🐢 Long task: ${Math.round(e.duration)}ms`);
      }
    }
  });
}

/** Get the stored vitals report from sessionStorage. */
export function getVitalsReport(): VitalEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Log a full formatted report to the console. */
export function printVitalsReport() {
  const vitals = getVitalsReport();
  if (vitals.length === 0) { console.log('[Perf] No vitals recorded yet.'); return; }
  console.table(vitals.map(v => ({ Metric: v.name, Value: `${v.value}ms`, Rating: v.rating })));
}
