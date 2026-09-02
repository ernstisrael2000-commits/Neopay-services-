---
name: Didit verification contract
description: Server-side rules for identity verification challenges used by admin login and card access
---

Didit is the source of truth for identity checks: create a short-lived provider session server-side, bind it to a local challenge, accept only a fresh HMAC-signed webhook, and validate the local challenge again before granting access.

**Why:** A browser callback or an unbound provider decision can be forged, replayed, or attached to the wrong account.

**How to apply:** Keep workflow IDs and callback URLs in environment configuration, never store biometric data, require purpose and subject matching, expire challenges strictly, and consume successful challenges atomically.

For account ownership, the verified legal name returned by Didit must match the authoritative name for the protected area after normalization (case, accents, punctuation, and token order). Admin login uses the current administrator full name. Card access uses only the explicit cardholder name returned by HeyQO, never the client profile name or email. Store only server-keyed fingerprints of matched names.

**Why:** A face/document match alone proves who is holding the document, but not ownership of the protected account or card. A client email or profile name may legitimately differ from the name printed on an existing card.

**How to apply:** Compare admin challenges against the admin full name. For Cards, resolve `name_on_card`, `cardholder_name`, or `cardholder` server-side from an active HeyQO card and fail closed if no active card or explicit holder name is available. Never fall back to the client profile name.

Returning clients reuse the exact Didit `vendor_data` associated with their first approved identity. Later sensitive actions use Didit's Biometric Authentication workflow with liveness and face match against Didit's stored face; they must not request identity documents again or copy the reference portrait into Firebase.

**Why:** Didit resolves a stored reference face by stable `vendor_data`. Generating a new provider identity for every challenge loses that link, while storing the portrait locally would unnecessarily expand the biometric-data attack surface.

**How to apply:** Persist only provider session identifiers, stable vendor data, verification status, purpose, mode, timestamps, and keyed identity fingerprints. Require both approved liveness and approved face match for biometric challenges, bind each challenge to one action purpose, and consume it atomically.