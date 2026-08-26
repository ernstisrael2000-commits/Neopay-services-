---
name: Formations content security model
description: How paid course content (video/PDF/quiz answers) is protected from unauthorized access in the formations/academy feature
---

# Formations content security

**Why:** `GET /api/formations` used to return full Formation documents (including
module `videoUrl`/`pdfUrl`, formation-level `resources`, and quiz `correctIndex`)
to anyone, and most `/api/formations/*` and `/api/teacher/*` routes trusted a
`userId`/`teacherId` passed in the request body/query instead of checking who
was actually logged in (IDOR). Both were fixed together since a public
Firestore rule (`formations: allow read: if true`) would otherwise let anyone
bypass any API-level redaction by reading Firestore directly.

## The pattern now in place

- `GET /api/formations` is still public/unauthenticated, but redacts protected
  fields via `redactFormationForViewer()` in `src/api/router.ts`: full
  `modules[].videoUrl`/`pdfUrl`/formation `resources` are only included for a
  formation the caller has an active `formation_purchases` record for (soft
  session read — anonymous visitors get the fully redacted view). Quiz
  `correctIndex` is **always** stripped for everyone, owners included —
  scoring happens server-side in `/api/formations/quiz/submit`.
- Every other client-facing formations route (purchases, progress, quiz
  submit/results, certificate, free-access, payment-request) now requires
  `requireClientSession` and takes the identity (`userId`/`clientId`) from the
  session, not from the request body/params — the client-supplied value is
  ignored or checked-and-rejected.
- Teacher routes (`/api/teacher/formations*`, `/api/teacher/withdrawal`,
  transactions, notifications) got the same treatment with a new
  `requireTeacherSession` middleware + `rena_teacher_session` cookie, mirroring
  the existing client/admin session cookie pattern exactly (HMAC-signed,
  HttpOnly, 8h expiry). Previously these had **zero** auth — anyone could
  edit/delete any teacher's course or request a withdrawal for any teacherId.
- `formations` Firestore rule changed from `allow read: if true` to
  `allow read: if isAdmin()` — direct client reads are now closed; the only
  legitimate consumer (a rare Firestore fallback in `FormationsView.tsx` used
  only if the `/api/formations` fetch itself fails) degrades acceptably.

## Frontend gotcha this created

`FormationsView.tsx` fetches `/api/formations` once on mount and keeps it in
`formations` state. Since the response is now purchase-aware, a purchase made
mid-session (wallet purchase, or the `alreadyOwned` branch of external
payment) must trigger a refetch (`loadFormations()`) or the player will try to
play a formation object that still has no `videoUrl` (stale redacted copy).

**How to apply:** any new client-facing formations/teacher endpoint must use
`requireClientSession`/`requireTeacherSession` and source the identity from
`res.locals.clientSession`/`res.locals.teacherSession`, never trust a body/
param id for "whose data is this". If a purchase/access-grant flow is added
that unlocks content without a page reload, call `loadFormations()` (or
equivalent) afterward.

## Still deferred (flagged, not fixed)

- Teacher passwords are stored/compared in plaintext (`data.password !==
  password`), unlike client passwords which use scrypt.
- SSE notification streams (`makeSseHandler`) for client/teacher/admin/agent
  roles have no auth at all — systemic, broader than formations.
- Purchase/credit flows (wallet purchase → teacher balance credit) aren't
  wrapped in a Firestore transaction — a real but lower-priority
  double-credit race risk.
- Per-creator commission config, admin "suspend formation/creator", and a
  public shareable `/formation/[slug]` SEO page are marketplace features from
  the original spec, not yet built.
