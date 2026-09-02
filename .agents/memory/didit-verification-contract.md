---
name: Didit verification contract
description: Server-side rules for identity verification challenges used by admin login and card access
---

Didit is the source of truth for identity checks: create a short-lived provider session server-side, bind it to a local challenge, accept only a fresh HMAC-signed webhook, and validate the local challenge again before granting access.

**Why:** A browser callback or an unbound provider decision can be forged, replayed, or attached to the wrong account.

**How to apply:** Keep workflow IDs and callback URLs in environment configuration, never store biometric data, require purpose and subject matching, expire challenges strictly, and consume successful challenges atomically.

For account ownership, the verified legal name returned by Didit must match the official first and last name of the person who owns the SolutionPAM account after normalization (case, accents, punctuation, and token order). Cardholder names returned by HeyQO are display/provider metadata only and must never authorize account or card access. Store only server-keyed fingerprints of matched account names.

**Why:** One account may legitimately manage several cards bearing different names. The security boundary protects the authenticated account owner, not any individual name printed on a card; email and cardholder labels are not identity proofs.

**How to apply:** Compare card challenges only against the separately collected official account first and last name and its server-keyed fingerprint. Require a fresh full Didit verification when that official identity changes. Never read or compare a HeyQO cardholder field when deciding access.

Returning clients reuse the exact Didit `vendor_data` associated with their first approved identity. Later sensitive actions use Didit's Biometric Authentication workflow with liveness and face match against Didit's stored face; they must not request identity documents again or copy the reference portrait into Firebase.

**Why:** Didit resolves a stored reference face by stable `vendor_data`. Generating a new provider identity for every challenge loses that link, while storing the portrait locally would unnecessarily expand the biometric-data attack surface.

**How to apply:** Persist only provider session identifiers, stable vendor data, verification status, purpose, mode, timestamps, and keyed identity fingerprints. Require both approved liveness and approved face match for biometric challenges, bind each challenge to one action purpose, and consume it atomically.

Didit's session `callback` is a browser return URL loaded after the capture flow; it is not a decision channel. Keep it on a dedicated, frameable, data-free completion page. Authoritative decisions come from the signed webhook or a server-authenticated read of Didit's decision API.

**Why:** Pointing the callback at the protected webhook causes an anti-framing error. In addition, a valid Didit approval may be available from the decision API before the local webhook state reflects it; relying only on local polling can leave the UI waiting until expiration.

**How to apply:** Let the completion page signal only that capture was submitted. While waiting, synchronize pending challenges through the authenticated decision API, allow enough time for mobile capture, and compare the official name server-side before advancing.