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

A SvelteKit personal site with a blog, projects section, a `/now` page, and a full comment system including voting, admin replies, IP bans, and rate limiting.

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
    admin/                 # Admin dashboard + auth
    api/
      comments/
        +server.ts                  # GET (public), POST (public, rate-limited)
        [id]/+server.ts             # PATCH (edit), DELETE (admin or user)
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
    internal/rss.xml/+server.ts     # RSS feed (prerendered)
convex/
  schema.js                # Convex table definitions
  comments.js              # comments.list / create / edit / softDelete / hardDelete / vote
  likes.js                 # likes.get / toggle
  bans.js                  # bans.list / ban / unban
  now.js                   # now.get / set
  admin.js                 # admin-only helpers (URL listing, etc.)
  rateLimits.js            # Convex rate-limiter component config
  lib/                     # Shared Convex helpers
```

---

## Convex Schema (`convex/schema.js`)

| Table          | Key fields                                                                                         | Indexes                       |
| -------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| `comments`     | url, username, passwordHash, text, ipHash, parentId (id\|null), depth, reply, updatedAt, deletedAt | `by_url`, `by_parent`         |
| `commentVotes` | commentId, ipHash, voteType (`'up'`\|`'down'`)                                                     | `by_comment`, `by_comment_ip` |
| `likes`        | url, ipHash                                                                                        | `by_url`, `by_url_ip`         |
| `bannedIps`    | ipHash, reason                                                                                     | `by_ip`                       |
| `nowPage`      | content, updatedAt                                                                                 | —                             |

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
| DELETE | `/api/comments/[id]`      | admin    | Hard-delete: sets `deletedAt`                  |
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

---

## Comment Deletion Semantics

- **Soft delete** — sets `text = '[deleted]'` and `username = '[deleted]'`. Row stays in the table; thread nesting is preserved. Shown to public as `[deleted]`.
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

## Schema Changes

Edit `convex/schema.js` and run `npx convex dev` (or `npx convex deploy` for prod). Convex generates indexes and types automatically — there are no SQL migration files to write or commit.

---

## Environment Variables

| Variable            | Used in                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `PUBLIC_CONVEX_URL` | Convex client — both browser (root layout) and server-side HTTP client                         |
| `ADMIN_SECRET`      | Admin auth (header + cookie + Convex bypass) — must match Convex env                           |
| `CONVEX_DEPLOY_KEY` | Build-time only (Vercel). Used by `npx convex deploy`; sets `PUBLIC_CONVEX_URL` automatically. |

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
