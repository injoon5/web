#!/bin/bash
# Make the repo runnable before an agent touches it.
#
# Two things block a fresh clone, and both look like credential errors:
#
#   1. No `.env`. `PUBLIC_CONVEX_URL`, `ADMIN_SECRET` and `IP_HASH_SECRET` are
#      read through `$env/static/private` / `$env/static/public`, which Vite
#      inlines at build time — so a missing one is a build failure
#      ("ADMIN_SECRET is not exported by virtual:env/static/private"), not a
#      runtime warning. `.env.example` has placeholders for all of them.
#   2. No `node_modules`.
#
# Neither needs a real Convex deployment: `npm test`, `npm run lint`, `npm run
# check` and `npm run build` all pass against placeholders. Only live Convex
# data (comments, likes, /now, /health) needs `npx convex dev`, which does need
# a login — nothing else does.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

if [ ! -f .env ] && [ -f .env.example ]; then
	cp .env.example .env
	echo "Seeded .env from .env.example (placeholder Convex values)."
fi

if [ -f package-lock.json ] || [ -f package.json ]; then
	npm install --no-audit --no-fund
fi

# Convex's generated client is committed, so type-checking and tests work
# without a deployment. Kit's own generated types are not.
npx svelte-kit sync
