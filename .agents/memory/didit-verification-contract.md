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

Client sessions use Didit's full KYC workflow, including for returning clients. The stable `vendor_data` is still reused so the provider identity remains linked, but no biometric-authentication workflow is required.

**Why:** The current free Didit setup does not have capacity for credit-consuming biometric-authentication sessions. Requiring full KYC keeps the requested second/third-login behavior explicit without silently bypassing identity verification.

**How to apply:** Persist only provider session identifiers, stable vendor data, verification status, purpose, mode, timestamps, and keyed identity fingerprints. Do not request or store biometric media locally.

Didit's session `callback` is a browser return URL loaded after the capture flow; it is not a decision channel. Keep it on a dedicated, frameable, data-free completion page. Authoritative decisions come from the signed webhook or a server-authenticated read of Didit's decision API.

**Why:** Pointing the callback at the protected webhook causes an anti-framing error. In addition, a valid Didit approval may be available from the decision API before the local webhook state reflects it; relying only on local polling can leave the UI waiting until expiration.

**How to apply:** Let the completion page signal only that capture was submitted. While waiting, synchronize pending challenges through the authenticated decision API, allow enough time for mobile capture, and compare the official name server-side before advancing.

Didit's v3 decision response places extracted legal-name fields in entries of the `id_verifications` array rather than in a top-level `identity`, `document`, or `decision` object.

**Why:** Reading only the older direct containers returns no verified name even when Didit reports `Approved`, causing a false account-name mismatch.

**How to apply:** Prefer the verified document entries from `id_verifications` (including their direct or nested document fields), then apply the established normalized full-name comparison.

The biometric-authentication workflow remains disabled for client sessions unless the product explicitly re-enables it with provider capacity.

**Why:** When provider credits are exhausted, Didit rejects biometric session creation before returning an iframe. Full KYC is the intended fallback for returning clients in the free setup.

**How to apply:** Keep mode selection explicit and ensure returning clients see the complete KYC flow rather than an unavailable biometric step.