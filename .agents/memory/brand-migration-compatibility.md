---
name: Brand migration compatibility
description: Rules for changing customer-facing branding without breaking historical client state.
---

Keep the public brand, SEO, PWA, notifications, emails, PDFs, certificates, and customer-facing messages aligned with Solutionpam. Preserve historical technical identifiers such as `rena_*` local-storage keys and cookies, `rena_balance`, and existing idempotency key prefixes.

**Why:** Renaming these persisted identifiers would silently disconnect users, hide preferences and notes, or break continuity for stored payment and order records.

**How to apply:** Treat every user-facing string as a rebranding candidate. Before changing an old identifier, check whether it is persisted, externally stored, or consumed by historical data; retain it when compatibility depends on it. Update it only through an explicit migration with backward-reading support.