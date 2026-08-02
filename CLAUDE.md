# Project Guidelines

## Quotes

- Always use straight quotes (`'`, `"`) in all files. Never use curly/smart quotes (`'`, `'`, `"`, `"`). Svelte's parser will throw `js_parse_error` on smart quotes inside `{}` expressions.

## Package Management

- After installing packages with npm, delete `pnpm-lock.yaml` if it exists — it goes stale and causes `ERR_PNPM_OUTDATED_LOCKFILE` errors.

---

## Language

- Do not use TypeScript. Write all Svelte scripts in plain JavaScript (no `lang="ts"`, no type annotations).

---

## Project Overview

A SvelteKit personal site with a blog, projects section, a `/now` page, a `/health` page fed by Apple Health, and a full comment system including voting, admin replies, IP bans, and rate limiting.

**Stack:** SvelteKit · Convex (database + functions + realtime) · bcryptjs (comment passwords) · Zod (input validation)

Rate limiting lives inside Convex via `@convex-dev/rate-limiter`, not Upstash Redis. There is no separate SQL database — all persistence is Convex tables.

---

## Directory Structure

```
src/
  hooks.server.ts          # SvelteKit server hook (passthrough)
  app.d.ts                 # Global type declarations
  lib/
    server/
      admin.ts             # verifyAdminSecret(request) — checks x-admin-secret header
      api.js               # convexErrorToResponse helper
      convex.js            # Server-side Convex HTTP client
      ip.ts                # getClientIp(request), hashIp(ip) — SHA-256 IP hashing
      content-modules.js   # Single home for the eager content md globs
      content-page.js      # Shared server load for blog/projects [slug] (prefLang + ipHash)
      valid-urls.js        # isValidPageUrl — guards comment/like writes to known pages
      validation.ts        # Zod schemas for all inputs
    types.ts               # Shared frontend types
    utils.ts               # Misc utilities
    comments/
      CommentsSection.svelte   # Public comment section (Convex useQuery, forms)
      CommentNode.svelte       # Individual user-facing comment + reply tree
      AdminCommentNode.svelte  # Admin dashboard comment node (admin only)
  routes/
    +page.ts               # Home (prerendered)
    blog/
      +page.ts             # Blog listing (prerendered)
      [slug]/+page.ts      # Blog post (prerendered, loads md via import.meta.glob)
    projects/
      +page.ts             # Projects listing (prerendered)
      [slug]/+page.ts      # Project detail (prerendered)
    now/+page.svelte       # /now page, Convex-backed, markdown via marked
    health/
      +page.server.js      # SSR load — fetches the Convex /health HTTP routes with HEALTH_API_KEY
      +page.svelte         # /health page — score dial + sparkline sections
    admin/                 # Admin dashboard + auth
    api/
      comments/
        +server.ts                  # GET (public), POST (public, rate-limited)
        [id]/+server.ts             # PATCH (edit), DELETE (soft-delete only)
        [id]/vote/+server.ts        # POST (vote, rate-limited)
        [id]/reply/+server.ts       # POST (admin reply — legacy, prefer admin route)
      likes/
        +server.ts                  # GET (count + did-I-like), POST (toggle)
      now/+server.ts                # POST (admin only) — write /now page content
      admin/
        comments/+server.ts         # GET urls/comments (admin only)
        comments/[id]/+server.ts    # POST reply, DELETE soft/hard (admin only)
        bans/+server.ts             # GET list, POST create ban (admin only)
        bans/[id]/+server.ts        # DELETE unban (admin only)
      posts/+server.ts              # Blog post metadata API (prerendered)
      projects/+server.ts           # Projects metadata API (prerendered)
    rss.xml/+server.ts              # RSS feed (prerendered; /internal/rss.xml redirects here)
convex/
  schema.js                # Convex table definitions
  comments.js              # comments.list / create / edit / softDelete / hardDelete / vote
  likes.js                 # likes.get / toggle
  bans.js                  # bans.list / ban / unban
  now.js                   # now.get / set
  admin.js                 # admin-only helpers (URL listing, etc.)
  rateLimits.js            # Convex rate-limiter component config
  health.js                # Apple Health — ingest mutation + internal reads (all internal)
  healthPublic.js          # The one public health query — see "Apple Health" below
  http.js                  # HTTP actions: /health/* (Bearer HEALTH_API_KEY)
  crons.js                 # Daily prune of raw health samples
  lib/                     # Shared Convex helpers
```

---

## Convex Schema (`convex/schema.js`)

| Table              | Key fields                                                                                                             | Indexes                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `comments`         | url, username, passwordHash, text, ipHash, parentId (id\|null), depth, reply, updatedAt, deletedAt, upvotes, downvotes | `by_url`, `by_parent`                      |
| `commentVotes`     | commentId, ipHash, voteType (`'up'`\|`'down'`)                                                                         | `by_comment_ip`, `by_ip`                   |
| `likes`            | url, ipHash                                                                                                            | `by_url_ip`                                |
| `commentUrlCounts` | url, count (denormalized active-comment counter)                                                                       | `by_url`                                   |
| `likeCounts`       | url, count (denormalized like counter)                                                                                 | `by_url`                                   |
| `migrationMeta`    | key, complete (one-time backfill completion flags)                                                                     | `by_key`                                   |
| `bannedIps`        | ipHash, reason                                                                                                         | `by_ip`                                    |
| `nowPage`          | content, updatedAt                                                                                                     | —                                          |
| `healthDaily`      | date (`YYYY-MM-DD`), metric, value, unit, source?, updatedAt                                                           | `by_metric_date`, `by_date`                |
| `healthBuckets`    | metric, hour (epoch ms), count, sum, min, max, unit                                                                    | `by_metric_hour`, `by_hour`                |
| `healthSamples`    | metric, value, time, unit, source? (raw, pruned at 30d)                                                                | `by_metric_time`, `by_time`                |
| `healthWorkouts`   | externalId, type, start, end, duration, distance?, activeEnergy?, avgHeartRate?, maxHeartRate?, elevation?, source?    | `by_start`, `by_type_start`, `by_external` |

Prefix rule: an index whose fields are a prefix of another (e.g. `by_comment`
vs `by_comment_ip`) is redundant — bind only the leading fields of the longer
index instead.

`ipHash` for the comment/like components is served by the shared
`src/lib/server/content-page.js` load on the SSR `[slug]` routes (and forwarded
by their universal loads). Do NOT move it into a root layout load: the root
pages are prerendered, which would bake the build machine's hash into the
static payload and never re-run on client-side navigation.

`createdAt` is Convex's built-in `_creationTime` on every doc.

---

## Authentication & Admin

- **Admin secret** stored in env var `ADMIN_SECRET`.
- **API auth:** `verifyAdminSecret(request)` checks the `x-admin-secret` request header (`src/lib/server/admin.ts`).
- **Page auth:** `src/routes/admin/+page.server.ts` compares the `admin_token` cookie to `ADMIN_SECRET`; sets an httpOnly cookie for 24 h on login. Exposes `adminSecret` to the page so the Svelte client can attach it to API calls.
- All `/api/admin/*` routes require the header; they return 401 otherwise.
- Convex mutations also accept an optional `adminSecret` argument; when present and valid, they bypass rate limits and per-IP checks.

---

## Rate Limiting

Rate limiting is implemented inside Convex via `@convex-dev/rate-limiter` (see `convex/rateLimits.js`). Limiters key on `ipHash`. **Admin requests with a valid `adminSecret` bypass all limits.**

Limits live in Convex so they survive across SvelteKit cold starts and apply consistently to direct Convex mutations as well as HTTP route calls.

When a limiter rejects, mutations throw; `convexErrorToResponse` in `src/lib/server/api.js` maps that to an HTTP 429 with a `Retry-After` header.

---

## API Routes Summary

### Public

| Method | Route                     | Auth     | Description                                    |
| ------ | ------------------------- | -------- | ---------------------------------------------- |
| GET    | `/api/comments?url=`      | —        | Fetch comments + vote counts for a page        |
| POST   | `/api/comments`           | —        | Create comment (ban check, rate-limited)       |
| PATCH  | `/api/comments/[id]`      | password | Edit own comment (bcrypt password check)       |
| DELETE | `/api/comments/[id]`      | password | Soft-delete: sets text+username to `[deleted]` |
| POST   | `/api/comments/[id]/vote` | —        | Toggle up/down vote (ban check, rate-limited)  |
| GET    | `/api/likes?url=`         | —        | Get like count + whether current IP liked      |
| POST   | `/api/likes`              | —        | Toggle like (ban check, rate-limited)          |
| POST   | `/api/now`                | admin    | Update `/now` page content                     |

### Admin (`x-admin-secret` header required)

| Method | Route                             | Description                                      |
| ------ | --------------------------------- | ------------------------------------------------ |
| GET    | `/api/admin/comments`             | List URLs with comment counts                    |
| GET    | `/api/admin/comments?url=`        | Fetch full comment list for a URL (incl. ipHash) |
| POST   | `/api/admin/comments/[id]`        | Set/clear admin reply (`{ reply: string }`)      |
| DELETE | `/api/admin/comments/[id]`        | Hard-delete (sets `deletedAt`)                   |
| DELETE | `/api/admin/comments/[id]?soft=1` | Soft-delete (sets text+username to `[deleted]`)  |
| GET    | `/api/admin/bans`                 | List all banned IPs                              |
| POST   | `/api/admin/bans`                 | Ban IP of a comment (`{ commentId, reason? }`)   |
| DELETE | `/api/admin/bans/[id]`            | Remove ban                                       |

---

## Realtime Queries

Public surfaces (CommentsSection, LikeButton, /now) subscribe to Convex via `convex-svelte`'s `useQuery`. Updates push over WebSocket, so no manual polling. `setupConvex(PUBLIC_CONVEX_URL)` runs once in the root layout.

CommentsSection and LikeButton pass `keepPreviousData: true` so their content
doesn't flash back to a skeleton when the `ipHash` re-subscription swaps the
query args. Because that also retains the _previous page's_ result across a
client-side navigation, both components track `freshPath` — the pathname the
latest non-stale result belongs to — and gate rendering and every write on
`freshPath === $page.url.pathname`. Any new `keepPreviousData` subscription
keyed on the pathname needs the same guard, or visitors can act on the page
they just left.

---

## Comment Deletion Semantics

- **Soft delete** — sets `text = '[deleted]'` and `username = '[deleted]'`. Row stays in the table; thread nesting is preserved. Shown to public as `[deleted]`.
  The public `DELETE /api/comments/[id]` route always soft-deletes and never
  inspects admin auth. The site owner browses their own posts holding an
  `admin_token` cookie, so branching on admin there turned an ordinary
  visitor-side delete into a hard delete of the whole subtree. Hard delete is
  reachable only through `DELETE /api/admin/comments/[id]`.

- **Hard delete** — sets `deletedAt` to a timestamp. Filtered out of all public queries. Children of a hard-deleted comment keep their `parentId` referencing the now-hidden row, which is surfaced as "stray" in the admin tree.

---

## Stray Comments (Admin Page)

When a parent comment is hard-deleted, its children still carry the original `parentId` but the parent is filtered out of public queries. The admin page's `buildTree()` function surfaces those children as root-level nodes with `stray: true` and renders them with an amber "orphaned reply — parent deleted" badge.

---

## Input Validation (`src/lib/server/validation.ts`)

| Schema                | Key fields                                                        |
| --------------------- | ----------------------------------------------------------------- |
| `createCommentSchema` | url, username (max 32), password (min 4), text (1–200), parentId? |
| `editCommentSchema`   | text (1–200), password (min 1)                                    |
| `voteSchema`          | voteType: `'up'`\|`'down'`                                        |
| `likeSchema`          | url                                                               |
| `replySchema`         | reply (max 1000)                                                  |
| `banSchema`           | commentId (Convex id), reason? (max 500)                          |

---

## Apple Health (`/health`)

Data arrives from an iOS Shortcut, is aggregated at write time, and is read back
in ranges sized to the visible window — a chart read touches about as many rows
as the chart plots points. A Watch produces 1000+ heart-rate samples a day;
reading all of them to draw 24 points is the failure mode the three tiers avoid.

### Endpoints (Convex HTTP actions, `<deployment>.convex.site`)

All require `Authorization: Bearer $HEALTH_API_KEY`.

| Method | Route              | Description                                                                           |
| ------ | ------------------ | ------------------------------------------------------------------------------------- |
| POST   | `/health/ingest`   | `{ date?, source?, metrics?, samples?, workouts? }` — all keys optional               |
| GET    | `/health/series`   | `?metrics=steps,restingHeartRate&days=90` or `?metric=heartRate&bucket=hour&hours=24` |
| GET    | `/health/workouts` | `?days=90&type=running&limit=50` — newest first                                       |
| GET    | `/health`          | Latest value per metric                                                               |
| GET    | `/health/day`      | `?date=YYYY-MM-DD`                                                                    |
| GET    | `/health/samples`  | `?metric=heartRate&hours=24` — debug/export                                           |

Series responses are dense arrays (`{ metric, unit, step, start, count, values, min?, max? }`)
with `null` for gaps and x implied by `start + index * step`, so dates never ship.
Past `maxPoints` (400) days merge into weeks — summed or averaged per
`metricKind()` — so a 5-year window returns ~260 points.

### Rules this code follows

- **Everything is internal**, because a query can't see an HTTP header and there
  is no `ctx.auth` identity here. The key-checking HTTP action is the entry
  point. `api.*` does not appear anywhere under `convex/`.
  - The one exception is `convex/healthPublic.js`, which backs the live
    subscription on `/health`. It serves _only_ what that public page already
    renders: a fixed metric allowlist (`PUBLIC_METRICS`) that arguments cannot
    widen, and only the range picker's own steps. No raw samples, no hourly
    buckets, no workouts, no other metrics.
- **No `Date.now()` in queries.** A query doesn't re-run when the clock moves,
  so a time-derived bound goes stale and churns the cache. The HTTP action
  computes bounds at day or hour granularity and passes them as arguments.
- **No `.collect()`, no `.filter()`** — bounded `.take()` and index conditions.
- **One mutation per ingest**, so day rows, rollups and workouts commit
  atomically.

### Things that will bite

- **Rollup double-counting.** `appendSamples` does one range read per touched
  hour to collect the timestamps already stored, and folds only _newly inserted_
  samples into the bucket. A sample added to a bucket sum twice can never be
  backed out. `convex/health.test.js` posts the same 100 samples twice and
  asserts `count` stays 100 — keep that test.
- **Step double-counting in Shortcuts.** "Find Health Samples" returns raw
  samples from every source, so summing steps without a `Source is <Apple Watch>`
  filter counts iPhone and Watch separately. The Health app deduplicates on
  display; Shortcuts does not.
- **Cache granularity.** Keep the range picker coarse (7/30/90/365) — every
  distinct `days` value is a distinct query argument, and so a distinct cache
  entry. The range is client state, deliberately not a `?days=` query string:
  a URL parameter is a lever anyone can pull, and it forked the SSR cache too.
  The server renders one window and echoes back the `endDate` it resolved; the
  picker pivots the live subscription on that rather than on the visitor's
  clock.
- **Ingest is capped per request:** 1000 samples spanning at most 12 metric-hours
  (the dedupe read per hour is what bounds the transaction), 64 metrics, 100
  workouts. Over that the endpoint returns 400 asking the caller to split.

### The Shortcut

Build steps live in `shortcuts/README.md`. The payloads it posts are checked in
at `shortcuts/payloads/*.json` and replayed through the real endpoint by
`convex/http.test.js`, so an app-side problem can be told apart from a backend
one. `shortcuts/smoke.mjs` posts them at a live deployment.

Metrics: Find Health Samples per metric (with the source filter) → Calculate
Statistics (Sum) → Format Date `yyyy-MM-dd` → Dictionary → POST. Automation:
hourly, Run Immediately, plus one at 23:55.

**Workouts are not synced.** The ingest mutation, the `healthWorkouts` table and
`GET /health/workouts` all still work and stay tested — Shortcuts just can't
build the payload, so nothing posts it and `/health` renders no workout list.

---

## Schema Changes

Edit `convex/schema.js` and run `npx convex dev` (or `npx convex deploy` for prod). Convex generates indexes and types automatically — there are no SQL migration files to write or commit.

---

## Environment Variables

| Variable            | Used in                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_CONVEX_URL` | Convex client — both browser (root layout) and server-side HTTP client                                         |
| `ADMIN_SECRET`      | Admin auth (header + cookie + Convex bypass) — must match Convex env                                           |
| `CONVEX_DEPLOY_KEY` | Build-time only (Vercel). Used by `npx convex deploy`; sets `PUBLIC_CONVEX_URL` automatically.                 |
| `HEALTH_API_KEY`    | Apple Health API — the Shortcut's bearer token and the `/health` SSR load. Must match Convex env.              |
| `CONVEX_SITE_URL`   | Optional override. Convex HTTP actions live on the `.site` twin of `PUBLIC_CONVEX_URL`, derived automatically. |

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
