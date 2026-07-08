---
name: Firebase project and database ID for Rena
description: The correct Firestore database ID for the Rena project's Firebase Admin SDK.
---

# Firebase Project & Database ID

## The rule
The Firebase Admin SDK must connect to the named Firestore database `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2`, not `(default)`.

**Why:** This Firebase project (`gen-lang-client-0739219145`) uses a named Firestore database, not the default one. Using `(default)` causes a gRPC `NOT_FOUND` (code 5) error on every Firestore query.

**How to apply:** In `src/api/router.ts`, `FIRESTORE_DB_ID` is now set to `process.env.FIRESTORE_DB_ID || 'ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2'`. The `FIRESTORE_DB_ID` env var can override this if the database changes. The `firebase-applet-config.json` also references the same named database for the frontend client.
