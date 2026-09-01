---
name: HeyQO virtual cards integration
description: HeyQO Business API facts and PCI-safe integration boundaries for Solutionpam.
---

HeyQO Business exposes partner-branded virtual Visa/Mastercard cards through `https://heyqo.cash/business/v1` and a sandbox base URL. A HeyQO customer must be created first with KYC fields, then its returned customer ID or local ID is used to issue cards. Card creation, deposits, withdrawals, freeze/unfreeze and termination are server-side operations.

**Why:** Card PAN/CVV must not pass through or be stored by Solutionpam. HeyQO provides a one-time secure-view iframe (about 90 seconds) for PCI-safe display, while normal card reads return only masked PAN and last four digits.

**How to apply:** Keep HeyQO credentials and all money-moving calls on the server, verify signed HMAC-SHA256 webhooks using the raw request body, treat HeyQO as authoritative for card balances, and implement wallet debit plus issuer-failure compensation transactionally before enabling production card issuance.

Card issuance locks must distinguish pre-provider failures (for example, insufficient wallet balance or failed KYC/status checks) from uncertain failures after the HeyQO card mutation starts. Only the latter should become `reconciliation_required`; pre-provider failures must remain retryable.

**Why:** A preflight wallet error was incorrectly classified as an uncertain provider outcome, blocking a valid retry even though HeyQO had created no card and no funds had been reserved.

**How to apply:** Set a provider-mutation flag immediately before the HeyQO card POST and use it when finalizing the issuance lock; keep wallet/idempotency safeguards for retries.