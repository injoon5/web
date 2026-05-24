#!/usr/bin/env bash
# Full production deploy: optimize static images, then Convex + SvelteKit build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Optimizing images in static/ (turbo + remote cache)"
npx turbo run build-image-cache apply-optimized-images

echo "==> Deploying Convex + building site"
if [[ -n "${CONVEX_DEPLOY_KEY:-}" ]]; then
	DECODED_KEY="$(node -e "console.log(decodeURIComponent(process.env.CONVEX_DEPLOY_KEY))")"
	export CONVEX_DEPLOY_KEY="$DECODED_KEY"
fi

exec npx convex deploy --cmd 'npm run build' "$@"
