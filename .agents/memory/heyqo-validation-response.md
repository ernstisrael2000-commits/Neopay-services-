---
name: HeyQO customer validation response
description: HeyQO Sandbox returns customer validation errors in a nested message.error array and requires E.164 phone values.
---

HeyQO customer validation details can arrive under `message.error[]`, including field-keyed objects or `{ field, message }` entries. Surface only the normalized messages, not the raw provider payload.

HeyQO customer documentation requires `phone` in E.164 format, for example `+50949324932`. Normalize common Haitian local formats before sending, while preserving already international numbers.

**Why:** A generic HTTP 422 hides the actionable validation reason, and profile phone values may be stored in local Haitian format.

**How to apply:** Parse nested provider validation arrays on the server and reject malformed phone values locally before any customer mutation.