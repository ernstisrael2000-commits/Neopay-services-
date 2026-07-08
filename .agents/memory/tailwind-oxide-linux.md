---
name: Tailwind native binding on Replit Linux x64
description: @tailwindcss/oxide requires a platform-specific native binary that npm doesn't install automatically on Replit's Linux x64 environment.
---

# Tailwind CSS Oxide Native Binding on Replit

## The rule
After any clean `npm install`, explicitly install `@tailwindcss/oxide-linux-x64-gnu` to get Vite's Tailwind plugin working on Replit.

**Why:** `@tailwindcss/vite` depends on `@tailwindcss/oxide` which uses a native NAPI-RS binary. npm's optional-dependency resolution sometimes skips the platform-specific package (`@tailwindcss/oxide-linux-x64-gnu`) on Linux x64, causing a "Cannot find native binding" error that prevents Vite from starting.

**How to apply:** Run `npm install @tailwindcss/oxide-linux-x64-gnu` after a fresh install if Vite fails with the native binding error. The package is already listed in node_modules after this fix.
