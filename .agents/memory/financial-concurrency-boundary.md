---
name: Financial concurrency boundary
description: Rule for protecting all balance-changing and terminal financial state transitions against concurrent requests.
---

Every financial approval, rejection, refund, debit, or credit must read its authoritative status and required balances inside the same database transaction that performs all dependent writes. Rate limiting and HTTP idempotency are additional defenses, not substitutes.

**Why:** Concurrent callers can use different idempotency keys or reach different processes. Any check performed before the transaction can become stale and allow duplicate credits, debits, refunds, logs, or notifications.

**How to apply:** For every money-moving route, transactionally re-read the pending record and balances, reject any non-pending state or insufficient balance, then write the terminal state, balance changes, and dependent audit records together. When an external provider can time out after accepting a mutation, keep a durable lock for that account/card and operation type in `reconciliation_required`; never allow a new provider call with a different idempotency key until the uncertain operation is resolved.