# Rena — Logistics & Fintech Platform

Multi-role web app (clients, affiliates, agents, admins) for parcel management, payments, wallets, and online formations.

## Stack
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Backend**: Express (tsx / Node 20)
- **Database**: Firebase Firestore (Admin SDK)
- **Auth**: Firebase client SDK
- **Email**: Resend (RESEND_API_KEY) or Nodemailer (SMTP_USER / SMTP_PASS)

## How to run

```bash
npm install
npm run dev      # Dev: Express on :5000, Vite on :5173
npm run build    # Production build
npm run start    # Production server
```

The workflow **Start application** runs `npm run dev` and exposes port 5000.

## Required secrets
| Secret | Purpose |
|--------|---------|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin SDK (Firestore, Auth) — JSON from Firebase Console → Service Accounts |
| `GROQ_API_KEY` | Groq AI API key (console.groq.com) |
| `RESEND_API_KEY` | Transactional email via Resend (resend.com) |
| `SESSION_SECRET` | Express session signing |

## Optional env vars (already set)
| Key | Value |
|-----|-------|
| `VAPID_PUBLIC_KEY` | Web push public key |
| `FIREBASE_VAPID_KEY` | Firebase messaging VAPID key |
| `APP_URL` | Public app URL |
| `RESEND_FROM_EMAIL` | Sender address for Resend |
| `ADMIN_EMAIL` | Admin notification address |

## Optional secrets
| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Transactional email via Resend |
| `SMTP_USER` / `SMTP_PASS` | Gmail SMTP fallback |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA v2 server-side |
| `VAPID_PRIVATE_KEY` | Web push private key |

## Project structure
```
src/pages/       — Views and dashboards per role
src/layouts/     — Navbar, BottomNav
src/components/  — Reusable UI components
src/hooks/       — React hooks
src/services/    — Firestore client services
src/lib/         — Firebase, email, utilities
src/types/       — TypeScript types
src/api/         — Express API router
database/        — Firestore & Storage rules
docs/            — Full documentation
```

## User preferences
- Keep the existing project structure and stack — do not restructure or migrate.
