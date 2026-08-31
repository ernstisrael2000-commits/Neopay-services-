---
name: Wallet API trust boundary
description: Security rule for wallet and balance endpoints implemented with the Firebase Admin SDK.
---

Every route that reads financial data, creates a transaction, or changes a balance must authenticate the caller server-side and derive the account ID from that verified session. An ID, code, email, UID, or display name supplied by the browser is not proof of identity.

**Why:** Firebase Admin SDK operations bypass Firestore security rules. Atomic transactions prevent race conditions but do not prevent an unauthenticated caller from targeting another account when a route trusts a body or URL identifier.

**How to apply:** Require role-specific signed sessions or verified Firebase ID tokens on all client, agent, affiliate, teacher, and admin financial endpoints. Compare any route parameter to the session identity, re-read balances inside the transaction, enforce idempotency, rate limits, and audit logs.