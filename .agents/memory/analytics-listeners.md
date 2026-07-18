---
name: Analytics nested listeners fix
description: Correct flat-listener pattern for multi-collection Firestore aggregation
---

## Rule
Never nest onSnapshot callbacks. Use flat independent listeners with shared ref + recompute pattern.

**Why:** Original analyticsService.ts nested 6 levels. Inner 5 listeners were NEVER unsubscribed. On every salesQ update, 5 new zombie listeners were created. Same bug existed in usePendingCounts (affiliateService.ts) with 3 levels.

**How to apply:**
- Store latest data in useRef (one key per collection)
- Track loaded state with a loaded ref
- Call recompute() (useCallback) after each listener fires
- Return () => unsubs.forEach(u => u()) from single useEffect
