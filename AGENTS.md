<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Cursor Cloud specific instructions

### Services

| Service              | Command          | Notes                                                                                                                 |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| SvelteKit dev server | `npm run dev`    | Vite on port 5173. Starts without Convex but realtime features (comments, likes, /now) need a live Convex deployment. |
| Convex backend       | `npx convex dev` | Requires Convex auth (`npx convex login`). Syncs functions & sets `PUBLIC_CONVEX_URL` in `.env`.                      |

### Quick reference

- **Install deps:** `npm install` (uses `package-lock.json`). Peer dependencies resolve cleanly — if you ever need `--legacy-peer-deps`, something regressed; fix the version instead of passing the flag.
- **Lint:** `npm run lint` (prettier + eslint). Clean — any output is something you introduced.
- **Type check:** `npm run check` (svelte-kit sync + svelte-check). Clean: 0 errors, 0 warnings.
- **Build:** `npm run build` (adapter-vercel output)
- **Optimize images:** `npm run optimize-images` (sharp; mozjpeg/png; max width 2400, JPEG q88). Cached in `.cache/` by source hash; Turbo Remote Cache restores that across Vercel deploys. Runs automatically in Vercel `buildCommand` and `npm run deploy`.
  The cache key is `.cache/source-fingerprints.json` — a content hash per tracked image, produced by an uncacheable `fingerprint-images` task that reads `git show HEAD:`. **Nothing commit-derived may enter that hash.** A commit SHA in `globalEnv` or in the fingerprint file changes on every deploy, which silently turns every build into a full re-encode of all ~108 images (~53s) with no cache hit ever.
- **Deploy:** `npm run deploy` (optimize images, then `npx convex deploy --cmd 'npm run build'`)
- **Format:** `npm run format` (prettier --write)

### Gotchas

- `PUBLIC_CONVEX_URL` is imported via `$env/static/public` (build-time). The dev server will start with a placeholder URL in `.env`, but Convex-backed features (comments, likes, /now page) won't work until a real Convex deployment is connected.
- `IP_HASH_SECRET` must be set on Vercel and listed in `turbo.json` `build.env` — SvelteKit inlines `$env/static/private` at build time; Turbo strict mode on Vercel only passes vars declared there.
- **Convex deploy key is URL-encoded** in the secrets store. Decode before use: `DECODED_KEY=$(node -e "console.log(decodeURIComponent(process.env.CONVEX_DEPLOY_KEY))")` then export `CONVEX_DEPLOY_KEY="$DECODED_KEY"`.
- To deploy Convex functions to a preview: `npx convex deploy --preview-create "my-preview-name" --cmd 'echo done' --cmd-url-env-var-name PUBLIC_CONVEX_URL`
- Set `ADMIN_SECRET` in Convex: `npx convex env set ADMIN_SECRET "$ADMIN_SECRET" --preview-name "my-preview-name"`
- After `npm install`, delete `pnpm-lock.yaml` if it appears (per `CLAUDE.md`).
- The `.env` file is gitignored. `.claude/hooks/session-start.sh` copies `.env.example` to `.env` on session start, so a fresh clone can build without any Convex credentials — placeholders are enough for `test`, `lint`, `check` and `build`. Only live data (comments, likes, `/now`, `/health`) needs a real deployment.
- **Missing env reads like a Convex auth failure and isn't.** `$env/static/private` is inlined by Vite at build time, so an absent `ADMIN_SECRET` fails the build with "not exported by virtual:env/static/private". Check `.env` exists before chasing credentials.
- No TypeScript in Svelte scripts - use plain JS (no `lang="ts"`, no type annotations in `.svelte` files).
- Always use straight quotes (`'`, `"`) - never curly/smart quotes.
- **`remark-math` is pinned to v3 on purpose.** mdsvex bundles a legacy remark, and v4+ (micromark-based) silently renders no math at all — no error, just missing KaTeX. Verify with a `$a^2$` compile before touching it.
- **Tailwind runs as a Vite plugin**, not through PostCSS. There is no `postcss.config.js`: Vite's own postcss-import pass resolves `@import 'tailwindcss'` as a file path and fails before a PostCSS plugin would run.
- **Turbo runs the Vercel build in strict env mode.** Anything the build reads
  off `process.env` must be listed in the task's `env` in `turbo.json`, or it is
  absent — not just unhashed. This silently disabled the DialKit preview panels
  for months (`VERCEL_ENV` was undeclared). Vercel also warns in the build log
  about project env vars missing from `turbo.json`; that warning is worth
  reading rather than muting.
- ESLint uses flat config (`eslint.config.js`). `.eslintrc.cjs` and `.eslintignore` do nothing in ESLint 9+; ignores live in the config's `ignores` array.
