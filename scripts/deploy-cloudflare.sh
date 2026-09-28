#!/usr/bin/env bash
# Publish the production Vite build to the omnician Worker on Cloudflare.
# Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment.
# Does not print secret values.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is not set. Add it as a Cursor Runtime Secret, then ask to deploy." >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID is not set. Add it as a Cursor Environment Variable, then ask to deploy." >&2
  exit 1
fi

echo "Building Omnician…"
npm run build

echo "Deploying Worker omnician (SPA assets)…"
npx wrangler deploy
