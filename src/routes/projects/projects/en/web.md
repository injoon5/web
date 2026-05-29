---
title: 'injoon5.com'
description: This site — blog, projects, comments, likes, and a Convex-backed /now page.
year: '2024'
tags:
  - SvelteKit
  - Convex
  - Vercel
published: true
---

## What you're looking at

You're reading this on it. [injoon5/web](https://github.com/injoon5/web) is my personal site — blog, project writeups, comments, likes, and the `/now` page. Prerendered where possible, realtime where it matters.

## Frontend

**SvelteKit** with mdsvex for Markdown content. Blog posts and project pages live as `.md` files with frontmatter; reading time gets computed at build time by a Remark plugin that counts words (English) or characters (Korean).

Multilingual support: blog posts and projects can exist in both `en/` and `ko/` directories. The slug page loads whichever languages are published and shows a pill toggle.

Homepage **Now Listening** and **Photos** widgets read from Convex (`homeFeedCache`). Crons pull Last.fm (`LAST_FM_PUBLIC_API_KEY`) every minute and [photos.injoon5.com/feed.json](https://photos.injoon5.com/feed.json) every hour — the old [injoon5/data](https://github.com/injoon5/data) repo is no longer on the read path.

## Convex backend

Anything live goes through Convex (`convex-svelte` subscriptions on the client):

| Table | Purpose |
| ----- | ------- |
| `comments` | Threaded comments per page URL, max depth 2 |
| `commentVotes` | Up/down votes keyed on SHA-256 IP hash |
| `likes` | Page-level like toggles |
| `bannedIps` | IP ban list |
| `nowPage` | Editable `/now` page content |
| `homeFeedCache` | Cached Last.fm + photos feed for the homepage |

Comments are sorted by **score** (upvotes − downvotes), then recency. Passwords are bcrypt-hashed for edit/delete. Rate limiting runs inside Convex via `@convex-dev/rate-limiter` — survives cold starts, applies to both HTTP routes and direct mutations. Admin requests with a valid `ADMIN_SECRET` bypass everything.

The admin dashboard (`/admin`) uses cookie auth + `x-admin-secret` header for API calls. Can reply to comments, soft/hard delete, ban IPs, view IP hashes.

## API layer

SvelteKit API routes (`/api/comments`, `/api/likes`, `/api/admin/*`) sit between the browser and Convex and do the unglamorous middle-layer work: IP hashing, Zod validation, bcrypt checks, and translating Convex errors into proper HTTP status codes (a 429 with `Retry-After` when you hit a rate limit).

## OG images

Built-in OG generation at `/api/og` — satori templates in `src/lib/og/templates.js` at 1200×630 with a dark dot-grid background. Separate layouts for blog posts, projects, and listing pages.

## Why I keep rebuilding it

This is version… many. Raster, Next.js iterations, Ghost themes, the whole oij-web era. I migrated comments off SQL + Redis specifically because I wanted Convex realtime subscriptions without managing infrastructure.

It's never done. But it's mine, and that's the point.
