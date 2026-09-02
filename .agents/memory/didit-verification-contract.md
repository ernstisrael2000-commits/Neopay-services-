---
name: Didit verification contract
description: Server-side rules for identity verification challenges used by admin login and card access
---

Didit is the source of truth for identity checks: create a short-lived provider session server-side, bind it to a local challenge, accept only a fresh HMAC-signed webhook, and validate the local challenge again before granting access.

**Why:** A browser callback or an unbound provider decision can be forged, replayed, or attached to the wrong account.

**How to apply:** Keep workflow IDs and callback URLs in environment configuration, never store biometric data, require purpose and subject matching, expire challenges strictly, and consume successful challenges atomically.