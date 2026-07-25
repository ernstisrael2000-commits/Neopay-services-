---
name: Security rules applied
description: Summary of all security fixes applied to enforce SECURITE_WALLET_PROMO.md and SECURITE_2FA_ADMIN_AGENT_AFFILIE.md rules
---

# Security Rules Applied — Rena

**Why:** Two security rule files were created and then enforced in code. Any future AI touching these areas must re-read SECURITE_WALLET_PROMO.md and SECURITE_2FA_ADMIN_AGENT_AFFILIE.md first.

## What was changed

### server: src/api/router.ts

1. **ADMIN_SECRET from env var** — `requireAdminSecret` now reads `process.env.ADMIN_SECRET` at startup (falls back to `rena-admin-2024` with a warning). Secret is set as a Replit Secret. Guard is defined at the top of the file (before first use) to avoid TDZ errors.

2. **NowPayments IPN signature mandatory** — Previously `if (ipnSecret && sig)` meant anyone could POST a fake `payment_status: finished` if the env var was missing. Now rejects with 500 if `NOWPAYMENTS_IPN_SECRET` is not configured, and 401 if signature is absent or wrong.

3. **Fazer orders — price fetched server-side** — Both `/api/fazer/topups/order` and `/api/fazer/giftcards/order` no longer accept `priceUSD` from the client. Price is fetched from FazerCards `/topups/offers` or `/giftcards/offers` server-side before deducting.

4. **Client withdrawal — runTransaction** — Was using `batch()` (read outside, write inside = race condition). Now uses `runTransaction()` that reads balance and deducts atomically. Same pattern for Fazer orders.

5. **Promo code validate** — Added: validity period check (dateStart/dateEnd), per-user usage check (maxUsesPerUser + onePerUser flag), check against `promo_code_usages` collection.

6. **Promo code use — atomic** — `/api/promo-codes/:id/use` now runs inside `runTransaction()`: re-validates expiry + max uses inside the transaction, increments `usedCount` atomically, writes per-user usage record to `promo_code_usages/{codeId}_{userId}`.

7. **OTP brute force protection** — `/api/client/confirm-withdrawal/:confirmId` tracks `otpFailedAttempts` on the confirmation document. After 5 wrong codes the request is expired and the user must ask the agent to renew.

8. **Admin login — IP logging** — `admin_login_logs` entries now include `ip` (from `x-forwarded-for`) and a `reason` field on failures.

9. **requireAdminSecret on sensitive routes** — Added to: GET /api/admin/transactions, DELETE /api/client/transactions/:clientId (both instances), GET/PATCH/DELETE /api/admin/notifications/*, POST /api/admin/withdrawal/:id/approve, POST /api/admin/agent/:agentId/toggle-lock.

### client: src/services/adminService.ts, src/services/parcelService.ts, src/pages/AdminDashboard.tsx, src/components/FazerPriceManager.tsx

- All hardcoded `'rena-admin-2024'` replaced with `import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024'`
- `VITE_ADMIN_SECRET` set as shared env var (same value currently — Ernst should rotate both `ADMIN_SECRET` secret and `VITE_ADMIN_SECRET` env var to a new random string when ready)

### database/firestore.rules

- `wallet_transactions`: `allow create/update: if false` — server only via Admin SDK
- `client_transactions`: `allow create: if false` — server only
- `affiliates`: balance/financial fields removed from client-writable keys; only `walletId` + `updatedAt` writable by authenticated owner
- `agents`: removed client self-update of `balance` — Admin SDK only

## Remaining gaps (not yet implemented — would require larger architectural work)

- **True 2FA at login for admin/agent/affilié**: currently only super-admins have a `loginCode` check. A full TOTP/OTP flow at login would require storing TOTP secrets, a setup wizard, and a two-step session token. Proposed as a follow-up task.
- **Firebase Auth token verification on admin API routes**: `requireAdminSecret` is a shared secret visible in the JS bundle. The proper fix is verifying a Firebase ID token server-side (`admin.auth().verifyIdToken()`). This is a bigger refactor.
- **Session inactivity timeout**: no auto-logout implemented. Frontend sessions persist via localStorage.

**How to apply:** Before any change touching wallet balance, promo codes, or admin auth — read SECURITE_WALLET_PROMO.md and SECURITE_2FA_ADMIN_AGENT_AFFILIE.md, then check this file for what's already done.
