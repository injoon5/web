# injoon5.com

A personal site: a bilingual blog, a projects section, a `/now` page, a
`/health` page fed by an Apple Watch, and a comment system with voting, admin
replies, IP bans and rate limiting.

**Stack:** SvelteKit · Convex (database, functions, realtime) · Tailwind ·
deployed on Vercel.

## Running it

```bash
npm install
npx convex dev     # provisions a deployment and writes PUBLIC_CONVEX_URL
npm run dev
```

`npx convex dev` needs to stay running alongside `npm run dev` — it watches
`convex/` and pushes schema and function changes.

## Scripts

| Command                   | Does                                             |
| ------------------------- | ------------------------------------------------ |
| `npm run dev`             | Dev server                                       |
| `npm run build`           | Production build                                 |
| `npm run preview`         | Serve the production build locally               |
| `npm test`                | Vitest, once                                     |
| `npm run test:watch`      | Vitest, watching                                 |
| `npm run check`           | `svelte-check` against `tsconfig.json`           |
| `npm run lint`            | Prettier check + ESLint                          |
| `npm run format`          | Prettier write                                   |
| `npm run optimize-images` | Re-encode tracked images through the turbo cache |

## Environment

| Variable                 | Where                                                               |
| ------------------------ | ------------------------------------------------------------------- |
| `PUBLIC_CONVEX_URL`      | Convex client, browser and server. Set by `npx convex dev`.         |
| `ADMIN_SECRET`           | Admin auth. Must match the same variable in the Convex env.         |
| `IP_HASH_SECRET`         | HMAC key for hashing visitor IPs.                                   |
| `CONVEX_DEPLOY_KEY`      | Build-time only, on Vercel.                                         |
| `HEALTH_API_KEY`         | Convex-side only — the bearer token the Health Shortcut posts with. |
| `LAST_FM_PUBLIC_API_KEY` | Convex-side only — read by the home-page feed cron.                 |

Convex-side variables are set with `npx convex env set`, not in `.env`.

## Layout

```
src/lib/        Components, plus health/, comments/, og/ and dev/ (DialKit)
src/routes/     Pages and the JSON API routes under api/
convex/         Schema, queries, mutations, actions, crons, HTTP actions
shortcuts/      The iOS Health Shortcut, its payload fixtures and a smoke script
```

Architecture notes, the Convex schema, and the reasoning behind the parts that
look odd live in [`CLAUDE.md`](./CLAUDE.md).
