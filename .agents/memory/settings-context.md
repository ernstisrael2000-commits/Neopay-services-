---
name: Settings Context optimization
description: useSettings() converted to React Context to prevent redundant Firestore listeners
---

## Rule
Never call useSettings() from parcelService in always-mounted components. Use useSettingsCtx() from src/contexts/SettingsContext.tsx.

**Why:** useSettings() was called in 15+ components. Each creates an independent onSnapshot listener on settings/global. App + Navbar + BottomNav + FormationsNavbar all mount simultaneously = 4+ redundant listeners at startup.

**How to apply:**
- <SettingsProvider> wraps App in src/App.tsx — creates exactly 1 listener
- Always-mounted layouts use useSettingsCtx()
- Lazy-loaded pages may still use useSettings() — they only mount one at a time
