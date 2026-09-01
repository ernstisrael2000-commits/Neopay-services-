---
name: Card access security
description: Durable security boundary for the virtual card area
---

Card details and card mutations must remain behind a server-only six-digit PIN hash, enabled email 2FA, and a short-lived signed HttpOnly card-access grant. Full details may reach the browser only after a fresh server-side PIN validation; otherwise return only configuration status, masked email, or masked card data.

**Why:** A six-digit PIN has a small search space, so even a salted hash must not be exposed through the browser-readable client profile. Email verification must be enforced by the API, not only by the page.

**How to apply:** Keep card security state in the server-only card security collection, gate every `/api/client/cards` data or mutation route, require the PIN again for sensitive detail reveal, avoid persistence/logging of full details, and clear the grant on client logout.