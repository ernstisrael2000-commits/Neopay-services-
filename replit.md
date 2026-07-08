# Rena — Logistics & Fintech Platform

## Overview
Multi-role web application for logistics (parcels), fintech (wallets, payments), and online training (formations). Supports four roles: Client, Affiliate, Agent, and Admin.

## Stack
- **Frontend**: React 19 + Vite 6 + Tailwind CSS 4 + Framer Motion + Radix UI (Shadcn/UI)
- **Backend**: Express (TypeScript via tsx) — serves as API gateway + Vite proxy in dev
- **Database/Auth**: Firebase (Firestore, Auth, Storage, Messaging)
- **Email**: Nodemailer (SMTP) or Resend
- **Push Notifications**: web-push (VAPID)
- **AI**: Google Generative AI (Gemini)

## How to Run
```
npm run dev
```
The Express server starts on port 5000 and spawns the Vite dev server on port 5173 (proxied through 5000).

## Required Secrets
| Secret | Description |
|--------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON (from Firebase Console → Project Settings → Service Accounts → Generate New Private Key) |

## Optional Environment Variables
| Variable | Description |
|----------|-------------|
| `SMTP_USER` | Gmail address for admin email notifications |
| `SMTP_PASS` | Gmail app password |
| `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA v2 secret key |
| `RECAPTCHA_SITE_KEY` | Google reCAPTCHA v2 site key (exposed to frontend) |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key (generate with `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |
| `FIRESTORE_DB_ID` | Firestore database ID (defaults to `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2`) |
| `PORT` | Server port (defaults to 5000) |

## Firebase Config
Frontend Firebase config is in `firebase-applet-config.json` (project: `gen-lang-client-0739219145`, named database: `ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2`).

## Project Structure
```
server.ts              # Express entry point
src/
  main.tsx             # React entry point
  App.tsx              # Routing + providers
  api/router.ts        # All backend API routes
  lib/firebase.ts      # Firebase client initialization
  lib/email.ts         # Email templates
firebase-applet-config.json  # Firebase project config
database/              # Firestore + Storage security rules
docs/                  # Detailed documentation
```

## Notes
- `@tailwindcss/oxide-linux-x64-gnu` must be installed for the native Tailwind binding on Linux x64 (already in node_modules).
- The Firestore database ID can be overridden via the `FIRESTORE_DB_ID` environment variable.
