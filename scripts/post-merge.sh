#!/usr/bin/env bash
set -euo pipefail

# Keep merged workspaces reproducible: install exactly the locked dependency set,
# then fail fast if the production bundle cannot be built.
npm ci --no-audit --no-fund
npm run build