---
name: VAPID push key pairing
description: VAPID key requirements for the Rena push notification setup
---

## Rule
Use one VAPID key pair for push notifications: the browser-facing public key must be sourced from `VAPID_PUBLIC_KEY`, and the private key must decode to exactly 32 bytes.

**Why:** The app previously had an older public key hardcoded in the browser while the server read a different environment value. `web-push` rejects malformed private keys at startup, and mismatched public/private keys cannot create valid subscriptions.

**How to apply:** Keep the frontend public key injection and server-side VAPID configuration aligned. If push startup reports an invalid private key, replace the private secret with the matching base64/base64url private key from the same generated pair; never silently trim or invent a key.