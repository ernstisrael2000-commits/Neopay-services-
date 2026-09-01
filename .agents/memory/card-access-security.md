---
name: Card access security
description: Durable security boundary for the virtual card area
---

Card details and card mutations must remain behind a server-only six-digit PIN hash, enabled email 2FA, and a short-lived signed HttpOnly card-access grant. The browser may receive only configuration status and masked email information.

**Why:** A six-digit PIN has a small search space, so even a salted hash must not be exposed through the browser-readable client profile. Email verification must be enforced by the API, not only by the page.

**How to apply:** Keep card security state in the server-only card security collection, gate every `/api/client/cards` data or mutation route, and clear the grant on client logout.