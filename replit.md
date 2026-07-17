# Rena — Logistics & Fintech Platform

Application web multi-rôles (clients, affiliés, agents, admins) pour la gestion de colis, paiements, portefeuilles et formations en ligne.

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, Node 20 (tsx) |
| Base de données | Cloud Firestore (named DB: `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2`) |
| Auth | Firebase Auth (clients) + credentials Firestore (admin/affiliate/agent) |
| Email | Resend / Nodemailer (optionnel) |
| Push | Web Push / FCM (optionnel) |

## How to run

```bash
npm install
npm run dev      # → http://localhost:5000
npm run build    # Production build
npm run start    # Production server
npm run lint     # TypeScript check
```

The workflow **Start application** runs `npm run dev` and serves on port 5000.

## Required secrets / env vars

| Variable | Required | Notes |
|----------|----------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | Full JSON of Firebase service account key |
| `SESSION_SECRET` | ✅ | Express session secret |
| `SMTP_USER` / `SMTP_PASS` | ❌ | Gmail SMTP for email notifications |
| `RESEND_API_KEY` | ❌ | Resend email service |
| `RECAPTCHA_SECRET_KEY` | ❌ | reCAPTCHA v2 secret |
| `VAPID_PRIVATE_KEY` | ❌ | Web Push private key |
| `MONCASH_SECRET_KEY` | ❌ | MonCash payment integration |

## Project structure

```
src/pages/        — Full views and dashboards
src/layouts/      — Navbar, BottomNav, FormationsNavbar
src/components/   — Reusable UI components (ui/, modals, forms)
src/hooks/        — Custom React hooks
src/services/     — Client-side Firestore logic
src/lib/          — Firebase, email, utilities
src/types/        — TypeScript types
database/         — Firestore & Storage rules
docs/             — Full documentation
server.ts         — Express backend entry point
```

## User preferences

_Add any preferences here as you work with the agent._
