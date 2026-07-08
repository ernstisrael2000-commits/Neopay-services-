---
name: Firebase project mismatch fix
description: The active Firebase project is neopay-446f3 with (default) Firestore DB — the old named DB ID causes NOT_FOUND errors
---

# Firebase Project & Database

**Active project**: `neopay-446f3`  
**Service account**: `firebase-adminsdk-fbsvc@neopay-446f3.iam.gserviceaccount.com`  
**Firestore database**: `(default)`  
**Firebase Console**: https://console.firebase.google.com/project/neopay-446f3

**Why:** The FIREBASE_SERVICE_ACCOUNT secret was updated to a service account from project `neopay-446f3`, but the code still referenced the old named database `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2` (from the original project `gen-lang-client-0739219145`). Every Firestore query returned `Error: 5 NOT_FOUND` because that named DB doesn't exist in `neopay-446f3`.

**How to apply:** `FIRESTORE_DB_ID` in `src/api/router.ts` must always be `'(default)'`. If it ever reverts to the old named ID, all Firestore queries will fail silently with NOT_FOUND.

**Diagnosis method:** The `/api/debug` endpoint (protected by `x-admin-secret: rena-admin-2024`) now returns `serviceAccount.projectId` and `firestoreTest.ok` — use it to verify connectivity and catch project mismatches instantly.

**Admin accounts in DB:**
- `Ernst Israel` / `neopayservices509@gmail.com` 
- `Phénix Services` / `phenixservices15@gmail.com`

**Login form uses `fullName`, not email** — users must type their exact fullName (e.g. "Ernst Israel"), not their email address.
