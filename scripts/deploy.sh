#!/usr/bin/env bash
# Full production deploy from a local checkout: Convex, then the site build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -n "${CONVEX_DEPLOY_KEY:-}" ]]; then
	DECODED_KEY="$(node -e "console.log(decodeURIComponent(process.env.CONVEX_DEPLOY_KEY))")"
	export CONVEX_DEPLOY_KEY="$DECODED_KEY"
fi

# The same command as vercel.json's buildCommand; turbo's `build` runs the
# image steps first.
exec npx convex deploy --cmd 'npx turbo run build' "$@"
