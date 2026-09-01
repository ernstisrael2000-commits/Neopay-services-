---
name: Mobile file picker compatibility
description: Android document-picker files can fail with FileReader even after successful selection.
---

For browser uploads from Android document pickers, prefer `File.arrayBuffer()` and convert bytes to base64 in chunks; keep a FileReader fallback for older WebViews.

**Why:** Some Android browsers expose the selected filename and File object but trigger FileReader.onerror when reading the same file, blocking the KYC submission before the server is called.

**How to apply:** Use byte-based reads for temporary JPG/PNG uploads, keep server-side MIME/signature validation authoritative, and never persist the base64 payload.