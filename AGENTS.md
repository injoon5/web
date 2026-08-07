<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Working in this repo

`CLAUDE.md` is the reference for architecture, schema, API surface and the
project's hard rules. This file covers only how to run things.

### Services

| Service              | Command          | Notes                                                                                                           |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| SvelteKit dev server | `npm run dev`    | Vite on port 5173. Starts without Convex, but realtime features (comments, likes, /now) need a live deployment. |
| Convex backend       | `npx convex dev` | Requires `npx convex login`. Syncs functions and sets `PUBLIC_CONVEX_URL` in `.env`.                            |

### Commands

- **Install:** `npm install`. Peer dependencies resolve cleanly — if you ever
  need `--legacy-peer-deps`, something regressed; fix the version instead.
- **Test:** `npm test` (vitest, three projects: unit / convex / component).
- **Lint:** `npm run lint` (prettier + eslint). Clean — any output is yours.
- **Type check:** `npm run check` (svelte-check). Clean: 0 errors, 0 warnings.
- **Build:** `npm run build` (adapter-vercel output).
- **Format:** `npm run format`.
- **Deploy:** `npm run deploy` (optimize images, then `npx convex deploy`).
- **Optimize images:** `npm run optimize-images` (sharp; max width 2400, JPEG
  q88). Cached in `.cache/` by source hash; Turbo Remote Cache restores that
  across Vercel deploys. Runs automatically in the Vercel `buildCommand`.

### Gotchas

- **Missing env reads like a Convex auth failure and isn't.**
  `$env/static/private` is inlined by Vite at build time, so an absent
  `ADMIN_SECRET` fails the build with "not exported by
  virtual:env/static/private". Check `.env` exists before chasing credentials.
  `.claude/hooks/session-start.sh` copies `.env.example` to `.env` on session
  start, and those placeholders are enough for `test`, `lint`, `check` and
  `build`. Only live data needs a real deployment.
- **Turbo runs the Vercel build in strict env mode.** Anything the build reads
  off `process.env` must be listed in the task's `env` in `turbo.json`, or it is
  absent — not just unhashed. This silently disabled the DialKit preview panels
  for months. Vercel also warns in the build log about project env vars missing
  from `turbo.json`; that warning is worth reading rather than muting.
- **The image cache key must stay commit-independent.** It is
  `.cache/source-fingerprints.json`, a content hash per tracked image produced by
  an uncacheable `fingerprint-images` task. Anything commit-derived in that hash
  turns every deploy into a full re-encode of all ~108 images with no cache hit.
- **The Convex deploy key is URL-encoded** in the secrets store. Decode before
  use: `DECODED_KEY=$(node -e "console.log(decodeURIComponent(process.env.CONVEX_DEPLOY_KEY))")`.
- Deploy Convex functions to a preview:
  `npx convex deploy --preview-create "name" --cmd 'echo done' --cmd-url-env-var-name PUBLIC_CONVEX_URL`,
  then `npx convex env set ADMIN_SECRET "$ADMIN_SECRET" --preview-name "name"`.
- **`remark-math` is pinned to v3 on purpose.** mdsvex bundles a legacy remark,
  and v4+ (micromark-based) silently renders no math at all — no error, just
  missing KaTeX. Verify with a `$a^2$` compile before touching it.
- **Tailwind runs as a Vite plugin**, not through PostCSS. There is no
  `postcss.config.js`: Vite's own postcss-import pass resolves
  `@import 'tailwindcss'` as a file path and fails before a PostCSS plugin runs.
- ESLint uses flat config. `.eslintrc.cjs` and `.eslintignore` do nothing in
  ESLint 9+; ignores live in the config's `ignores` array.
