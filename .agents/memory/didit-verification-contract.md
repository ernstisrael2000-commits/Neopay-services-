---
name: Didit verification contract
description: Server-side rules for identity verification challenges used by admin login and card access
---

Didit is the source of truth for identity checks: create a short-lived provider session server-side, bind it to a local challenge, accept only a fresh HMAC-signed webhook, and validate the local challenge again before granting access.

**Why:** A browser callback or an unbound provider decision can be forged, replayed, or attached to the wrong account.

**How to apply:** Keep workflow IDs and callback URLs in environment configuration, never store biometric data, require purpose and subject matching, expire challenges strictly, and consume successful challenges atomically.

For account ownership, the verified legal name returned by Didit must match the current Solution PAM account name after normalization (case, accents, punctuation, and token order). Store only a server-keyed fingerprint of the matched name.

**Why:** A face/document match alone proves who is holding the document, but does not prove that the person is the owner of the Solution PAM account requesting a card or admin access.

**How to apply:** Compare against the admin full name or client legal name before granting access or issuing a card; fail closed when Didit returns no usable name or a different name, and invalidate the match if the local account name changes.