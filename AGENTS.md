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

| Service | Command | Notes |
|---------|---------|-------|
| SvelteKit dev server | `npm run dev` | Vite on port 5173. Starts without Convex but realtime features (comments, likes, /now) need a live Convex deployment. |
| Convex backend | `npx convex dev` | Requires Convex auth (`npx convex login`). Syncs functions & sets `PUBLIC_CONVEX_URL` in `.env`. |

### Quick reference

- **Install deps:** `npm install` (uses `package-lock.json`; `.npmrc` sets `legacy-peer-deps=true`)
- **Lint:** `npm run lint` (prettier + eslint). Pre-existing warnings exist in the repo.
- **Type check:** `npm run check` (svelte-kit sync + svelte-check). Pre-existing type errors exist.
- **Build:** `npm run build` (adapter-vercel output)
- **Optimize images:** `npm run optimize-images` (sharp; mozjpeg/png; max width 1920). Runs automatically in Vercel `buildCommand` and `npm run deploy`.
- **Deploy:** `npm run deploy` (optimize images, then `npx convex deploy --cmd 'npm run build'`)
- **Format:** `npm run format` (prettier --write)

### Gotchas

- `PUBLIC_CONVEX_URL` is imported via `$env/static/public` (build-time). The dev server will start with a placeholder URL in `.env`, but Convex-backed features (comments, likes, /now page) won't work until a real Convex deployment is connected.
- **Convex deploy key is URL-encoded** in the secrets store. Decode before use: `DECODED_KEY=$(node -e "console.log(decodeURIComponent(process.env.CONVEX_DEPLOY_KEY))")` then export `CONVEX_DEPLOY_KEY="$DECODED_KEY"`.
- To deploy Convex functions to a preview: `npx convex deploy --preview-create "my-preview-name" --cmd 'echo done' --cmd-url-env-var-name PUBLIC_CONVEX_URL`
- Set `ADMIN_SECRET` in Convex: `npx convex env set ADMIN_SECRET "$ADMIN_SECRET" --preview-name "my-preview-name"`
- After `npm install`, delete `pnpm-lock.yaml` if it appears (per `CLAUDE.md`).
- The `.env` file is gitignored. Copy `.env.example` to `.env` for local dev.
- No TypeScript in Svelte scripts - use plain JS (no `lang="ts"`, no type annotations in `.svelte` files).
- Always use straight quotes (`'`, `"`) - never curly/smart quotes.
