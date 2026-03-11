# Project Guidelines

## Language

- Do not use TypeScript. Write all Svelte scripts in plain JavaScript (no `lang="ts"`, no type annotations).

---

## Project Overview

A SvelteKit personal site with a blog, projects section, and a full comment system including voting, admin replies, IP bans, and rate limiting.

**Stack:** SvelteKit · PostgreSQL (Drizzle ORM) · Upstash Redis (rate limiting) · bcryptjs (comment passwords) · Zod (validation)

---

## Directory Structure

```
src/
  hooks.server.ts          # SvelteKit server hook (passthrough)
  app.d.ts                 # Global type declarations
  lib/
    server/
      admin.ts             # verifyAdminSecret(request) — checks x-admin-secret header
      ip.ts                # getClientIp(request), hashIp(ip) — SHA-256 IP hashing
      redis.ts             # Upstash rate limiters (commentRatelimit, voteRatelimit, likeRatelimit, editRatelimit)
      validation.ts        # Zod schemas for all inputs
      db/
        index.ts           # Drizzle db instance
        schema.ts          # All table definitions + inferred types
    types.ts               # Shared frontend types
    utils.ts               # Misc utilities
    comments/
      CommentsSection.svelte   # Public comment section (fetches, renders, handles forms)
      CommentCard.svelte       # Individual user-facing comment
      AdminCommentCard.svelte  # Admin dashboard comment card
  routes/
    +page.ts               # Home
    blog/
      +page.ts             # Blog listing
      [slug]/+page.ts      # Blog post
    projects/
      +page.ts             # Projects listing
      [slug]/+page.ts      # Project detail
    admin/
      +page.svelte         # Admin dashboard (login, comment tree, bans)
      +page.server.ts      # Auth: cookie-based login/logout, exposes adminSecret to page
    api/
      comments/
        +server.ts                  # GET (public), POST (public, rate-limited)
        [id]/+server.ts             # PATCH (edit, rate-limited), DELETE (admin or user)
        [id]/vote/+server.ts        # POST (vote, rate-limited)
        [id]/reply/+server.ts       # POST (admin reply — legacy, prefer admin route)
      likes/
        +server.ts                  # GET (count + did-I-like), POST (toggle, rate-limited)
      admin/
        comments/+server.ts         # GET urls list or comments for url (admin only)
        comments/[id]/+server.ts    # POST (set reply), DELETE ?soft=1 or hard (admin only)
        bans/+server.ts             # GET list, POST create ban from commentId (admin only)
        bans/[id]/+server.ts        # DELETE unban (admin only)
      posts/+server.ts              # Blog post metadata API
      projects/+server.ts           # Projects metadata API
    internal/rss.xml/+server.ts     # RSS feed
```

---

## Database Schema (`src/lib/server/db/schema.ts`)

### `comments`
| Column        | Type        | Notes                                      |
|---------------|-------------|--------------------------------------------|
| id            | uuid PK     |                                            |
| url           | text        | Page path the comment belongs to           |
| username      | text        | Default `'Anonymous'`, max 32 chars        |
| passwordHash  | text        | bcryptjs hash (rounds=10)                  |
| text          | text        | Max 200 chars                              |
| ipHash        | text        | SHA-256 of client IP                       |
| parentId      | uuid        | FK → comments.id ON DELETE SET NULL        |
| depth         | int         | 0 = root, 1 = reply, 2 = sub-reply (max)  |
| reply         | text\|null  | Admin reply text                           |
| createdAt     | timestamptz |                                            |
| updatedAt     | timestamptz |                                            |
| deletedAt     | timestamptz | Hard delete marker (null = active)         |

### `comment_votes`
| Column    | Type            | Notes                          |
|-----------|-----------------|--------------------------------|
| id        | uuid PK         |                                |
| commentId | uuid FK cascade | → comments.id                  |
| ipHash    | text            |                                |
| voteType  | enum            | `'up'` \| `'down'`             |

Unique index on `(commentId, ipHash)`.

### `likes`
| Column    | Type | Notes                    |
|-----------|------|--------------------------|
| url       | text | Page path                |
| ipHash    | text |                          |

Unique index on `(url, ipHash)`.

### `banned_ips`
| Column    | Type        | Notes                       |
|-----------|-------------|-----------------------------|
| id        | uuid PK     |                             |
| ipHash    | text unique | SHA-256 of banned IP        |
| reason    | text\|null  |                             |
| createdAt | timestamptz |                             |

---

## Authentication & Admin

- **Admin secret** stored in env var `ADMIN_SECRET`.
- **API auth:** `verifyAdminSecret(request)` checks the `x-admin-secret` request header (`src/lib/server/admin.ts`).
- **Page auth:** `+page.server.ts` compares the `admin_token` cookie to `ADMIN_SECRET`; sets an httpOnly cookie for 24 h on login. Exposes `adminSecret` to the page so the Svelte client can attach it to API calls.
- All `/api/admin/*` routes require the header; they return 401 otherwise.

---

## Rate Limiting (`src/lib/server/redis.ts`)

Upstash Redis sliding-window limiters, keyed by IP hash. **Admin requests (valid `x-admin-secret`) bypass all rate limits.**

| Limiter           | Limit            | Applied to                         |
|-------------------|------------------|------------------------------------|
| `commentRatelimit`| 3 / 10 min       | `POST /api/comments`               |
| `voteRatelimit`   | 30 / 1 min       | `POST /api/comments/[id]/vote`     |
| `likeRatelimit`   | 10 / 1 min       | `POST /api/likes`                  |
| `editRatelimit`   | 5 / 10 min       | `PATCH /api/comments/[id]`, `DELETE /api/comments/[id]` (user path) |

Rate-limited routes return HTTP 429 with a `Retry-After` header (seconds).

---

## API Routes Summary

### Public

| Method | Route                        | Auth     | Rate limit      | Description                                  |
|--------|------------------------------|----------|-----------------|----------------------------------------------|
| GET    | `/api/comments?url=`         | —        | —               | Fetch comments + vote counts for a page      |
| POST   | `/api/comments`              | —        | comment         | Create comment (ban check first)             |
| PATCH  | `/api/comments/[id]`         | password | edit            | Edit own comment (bcrypt password check)     |
| DELETE | `/api/comments/[id]`         | password | edit (user path)| Soft-delete: sets text+username to `[deleted]`|
| DELETE | `/api/comments/[id]`         | admin    | —               | Hard-delete: sets `deletedAt`                |
| POST   | `/api/comments/[id]/vote`    | —        | vote            | Toggle up/down vote (ban check first)        |
| GET    | `/api/likes?url=`            | —        | —               | Get like count + whether current IP liked    |
| POST   | `/api/likes`                 | —        | like            | Toggle like (ban check first)                |

### Admin (`x-admin-secret` header required)

| Method | Route                           | Description                                    |
|--------|---------------------------------|------------------------------------------------|
| GET    | `/api/admin/comments`           | List URLs with comment counts                  |
| GET    | `/api/admin/comments?url=`      | Fetch full comment list for a URL (incl. ipHash)|
| POST   | `/api/admin/comments/[id]`      | Set/clear admin reply (`{ reply: string }`)    |
| DELETE | `/api/admin/comments/[id]`      | Hard-delete (sets `deletedAt`)                 |
| DELETE | `/api/admin/comments/[id]?soft=1`| Soft-delete (sets text+username to `[deleted]`)|
| GET    | `/api/admin/bans`               | List all banned IPs                            |
| POST   | `/api/admin/bans`               | Ban IP of a comment (`{ commentId, reason? }`) |
| DELETE | `/api/admin/bans/[id]`          | Remove ban                                     |

---

## Comment Deletion Semantics

- **Soft delete** — sets `text = '[deleted]'` and `username = '[deleted]'`. Row stays in DB; thread nesting is preserved. Shown to public as `[deleted]`.
- **Hard delete** — sets `deletedAt`. Filtered out of all public queries (`WHERE deletedAt IS NULL`). Children with `parentId` pointing to this comment get `parentId = NULL` (FK `ON DELETE SET NULL`). Those orphaned children are "stray comments."

---

## Stray Comments (Admin Page)

When a parent comment is hard-deleted, its children have `parentId` set to `NULL` (due to FK `ON DELETE SET NULL`). Wait — actually the FK is `ON DELETE SET NULL`, so `parentId` becomes NULL and children are not stray by parentId alone.

However if a comment was hard-deleted *before* the FK cascade ran (or via `deletedAt` soft mechanism), children may still have a `parentId` that is absent from the fetched results. The admin page's `buildTree()` function handles this: comments with a `parentId` that doesn't exist in the fetched set are surfaced as root-level nodes with `stray: true` and rendered with an amber "orphaned reply — parent deleted" badge.

---

## Input Validation (`src/lib/server/validation.ts`)

| Schema                | Key fields                                                      |
|-----------------------|-----------------------------------------------------------------|
| `createCommentSchema` | url, username (max 32), password (min 4), text (1–200), parentId? |
| `editCommentSchema`   | text (1–200), password (min 1)                                  |
| `voteSchema`          | voteType: `'up'`\|`'down'`                                      |
| `likeSchema`          | url                                                             |
| `replySchema`         | reply (max 1000)                                                |
| `banSchema`           | commentId (uuid), reason? (max 500)                             |

---

## Database Migrations

- **Never write migration files by hand.** Drizzle migrations are generated — always use the CLI:
  ```
  npx drizzle-kit generate   # generate migration from schema changes
  npx drizzle-kit migrate    # apply pending migrations
  ```
- Only edit `src/lib/server/db/schema.ts` to change the schema, then run the generator.
- Do not create or modify files under `drizzle/` manually.

---

## Environment Variables

| Variable                  | Used in                    |
|---------------------------|----------------------------|
| `DATABASE_URL`            | Drizzle db connection      |
| `ADMIN_SECRET`            | Admin auth (header + cookie)|
| `UPSTASH_REDIS_REST_URL`  | Rate limiting              |
| `UPSTASH_REDIS_REST_TOKEN`| Rate limiting              |
