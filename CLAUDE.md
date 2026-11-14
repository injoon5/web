# Project Guidelines

## Hard rules

- **Straight quotes only** (`'`, `"`). Svelte's parser throws `js_parse_error` on
  smart quotes inside `{}` expressions.
- **No TypeScript.** Everything is plain JavaScript with JSDoc. `src/app.d.ts`
  and `src/lib/types.d.ts` are the only `.ts` files — both are type-only.
  Security-relevant modules (`src/lib/server/*`) carry `// @ts-check`, which
  `npm run check` enforces.
- **`.js` modules are kebab-case; `.svelte` components are PascalCase.**
- **A hydration mismatch is a 500 page.** SvelteKit 3 hydrates inside a root
  error boundary, so Svelte's `HYDRATION_ERROR` no longer falls back to a silent
  client re-render — it reaches `handleError` and the page swaps to `+error`.
  Server and client must render identical markup; that is why
  `#lib/ui/NumberFlow.svelte` replaces `@number-flow/svelte`. After a change to
  an SSR'd page, load it in a browser, not just over `curl`.
- **Imports go through `#lib/*` and `#convex/*`, with the file extension.**
  They are package.json subpath imports (SvelteKit 3 dropped `$lib` and
  deprecated `config.alias`), so `'#convex/_generated/api.js'`, not
  `'$convex/_generated/api'`. Markdown posts and the VS Code extension's
  inserted imports follow the same rule.
- After `npm install`, delete `pnpm-lock.yaml` if it appears — it goes stale and
  causes `ERR_PNPM_OUTDATED_LOCKFILE`.

### Dependencies held back on purpose

`npm outdated` lists these; each is pinned for a reason that a blind bump breaks.

- **`typescript` ~6.0** — SvelteKit 3, `svelte-check` and `typescript-eslint`
  all cap their peer at 6.x (`typescript-eslint` at <6.1).
- **`remark-math` 3** — mdsvex 0.12 bundles the pre-micromark `remark-parse`, and
  remark-math 4+ is a micromark extension it cannot load.
- **`remark-footnotes` 2** — the same parser, the same reason: 3+ is micromark.
- **`katex` and `overrides["rehype-katex-svelte"].katex`** — `katex` is declared
  so `katex/dist/katex.min.css` resolves, and the override makes
  `rehype-katex-svelte` (which caps it at `^0.16`) render with that same copy:
  the sheet has to match the markup, and 0.18.2 is the first release clear of
  GHSA-238p-pmpm-9mq7. 0.19 renamed KaTeX's own classes (`base` →
  `katex-base`); one copy is what keeps the two halves agreeing. Drop the
  override once `rehype-katex-svelte` accepts the declared version.
- **`overrides["@tailwindcss/typography"]["postcss-selector-parser"]`** —
  typography pins 6.0.10, below the fix for GHSA-rj75-hqrm-r3gf, and npm's own
  "fix" is a downgrade of typography. 7.x produced a byte-identical stylesheet.
- **`satori` ~0.32** — 0.33 shapes text with HarfBuzz, whose `hb.wasm` is read
  off disk at import time and is not traced into the Vercel function, so every
  OG image 500s in production while working locally. Check
  `.vercel/output/functions/**/node_modules/harfbuzzjs/hb.wasm` exists before
  moving past it.
- **`overrides.runed`** — reached through `convex-svelte` and `layerchart`, and
  still declares an optional peer on SvelteKit 2. Drop the override once a
  release accepts 3.

---

## Project Overview

A SvelteKit personal site: a blog, a projects section, `/now`, a `/health` page
fed by Apple Health, and a comment system with voting, admin replies, IP bans
and rate limiting.

**Stack:** SvelteKit 3 · Convex (database + functions + realtime) · bcryptjs ·
Zod. Rate limiting lives inside Convex via `@convex-dev/rate-limiter`, not
Upstash. There is no SQL database — all persistence is Convex tables.

---

## Directory Structure

```
src/
  app.css                  # Tokens, base layer, feature keyframes
  app.d.ts                 # Ambient declarations (__DIALS__, App namespace)
  app.html                 # Owns the dark/light class on <html> (pre-hydration)
  env.js                   # Declares every env var → $app/env/public, $app/env/private
  hooks.server.js          # Resolves the %lang% placeholder in app.html (from the URL)
  params.js                # Route param matchers (`lang`)
  content/                 # Markdown, outside the router
    blog/{en,ko}/*.md
    projects/{en,ko}/*.md
  lib/
    api-client.js          # apiFetch — the only way components call /api
    article-visitor.svelte.js  # articleVisitor (path + ipHash) and freshFor, for
                           # the likes and comments widgets
    cookies.js             # Every cookie name, and readCookie
    format.js              # formatDate / formatDateLong / formatDateTime / formatRelative
    reduced-motion.svelte.js  # One shared prefers-reduced-motion subscription
    theme.svelte.js        # Observes the class app.html sets; never sets it
    types.d.ts             # Post / Project / Tags
    actions/               # auto-height, marquee
    article/               # Article, SwapLine, article-load, ArticleDials + settings
    comments/              # CommentsSection, CommentNode, AdminCommentNode, build-tree
    content/               # article-paths (language ↔ URL), article-modules (lazy globs),
                           # article-index (client cache of /api/articles.json),
                           # preload-articles
    dev/                   # DialsHost, DialsMount
    error/                 # ErrorPage, LifeField, life, glyph, settings
    fonts/                 # interlude.json (generated manifest) + its guard test
    health/                # MetricChart, MetricSection, RangePicker, ScoreDial, metrics
    home/                  # HomeDials + settings
    lightbox/              # Lightbox, Gallery, store, geometry, spring, velocity,
                           # flight, modal, image-cache
    likes/LikeButton.svelte
    markdown/              # remark-gallery, remark-image-size, image-size,
                           # remark-lazy-video, splice-import, remark-reading-time,
                           # post-lang, static-file, code-highlighter, code-theme,
                           # remark-stylesheets, remark-youtube, video-size,
                           # rehype-footnotes, KatexFonts, image-variants,
                           # image-sizes
    nav/                   # NavBar, NavDials, settings, hero
    og/                    # satori OG image templates + render; url.js (ogImageUrl)
    pasito/                # Svelte port of joshpuckett/pasito
    server/                # admin, api, callers (visitorArgs/adminArgs),
                           # catalogue (every published article, once),
                           # article-index, content, content-modules, convex, ip,
                           # page-lang, series, sitemap, validation
    visitor.svelte.js      # ipHash (once per session) + the language cookie
    techstack/             # TechStack + data
    ui/                    # LanguageSwitcher, LazyVideo, NumberFlow, SeriesList,
                           # StableLangStack, swap-blur
  routes/
    +page.server.js        # Home (ISR, 5 min) — lists + the two feeds
    blog/, projects/       # Listing + [slug]/[[lang=lang]], all prerendered
    now/, health/, admin/
    api/                   # comments, likes, now, og, posts, projects, visitor,
                           # articles.json, admin/*
    rss.xml/+server.js
convex/
  schema.js comments.js likes.js bans.js now.js feeds.js admin.js adminSessions.js
  rateLimits.js health.js healthPublic.js http.js crons.js backfill.js
  lib/                     # Shared helpers; the pure ones are unit-tested
```

Tests are co-located (`*.test.js`, `*.svelte.test.js`). `vitest.config.ts`
defines three projects: `unit` (node), `convex` (edge-runtime), `component`
(jsdom).

**`npm run test:e2e`** (`scripts/e2e-test.mjs`) checks a production build in
Chromium: it builds against a fake Convex HTTP API (`scripts/e2e/fake-convex.mjs`),
serves it with `vite preview`, and fails on any sitemap URL that errors or
hydrates badly, an article a click cannot open, a broken language switch,
lightbox or comments mount, a CSP violation, or an `ipHash`-keyed write that
reaches Convex without the server credential. Not part of `npm test` — it builds
the site. Run it after anything that touches routing, loads, hydration, the CSP
or the API routes. `--no-build` reuses a build made against the fake.

---

## Convex Schema (`convex/schema.js`)

| Table              | Key fields                                                                                                                     | Indexes                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `comments`         | url, username, passwordHash, text, ipHash, parentId (id\|null), depth, reply, updatedAt, deletedAt, upvotes, downvotes, score? | `by_url_deleted_parent_score`, `by_parent` |
| `commentVotes`     | commentId, ipHash, voteType (`'up'`\|`'down'`)                                                                                 | `by_comment_ip`, `by_ip`                   |
| `likes`            | url, ipHash                                                                                                                    | `by_url_ip`                                |
| `commentUrlCounts` | url, count                                                                                                                     | `by_url`                                   |
| `likeCounts`       | url, count                                                                                                                     | `by_url`                                   |
| `migrationMeta`    | key, complete                                                                                                                  | `by_key`                                   |
| `bannedIps`        | ipHash, reason                                                                                                                 | `by_ip`                                    |
| `adminSessions`    | tokenHash (SHA-256 of the `admin_token` cookie), expiresAt                                                                     | `by_token`                                 |
| `nowPage`          | content, updatedAt                                                                                                             | —                                          |
| `nowPlaying`       | tracks[], updatedAt — one row                                                                                                  | —                                          |
| `photos`           | photos[], updatedAt — one row                                                                                                  | —                                          |
| `healthDaily`      | date (`YYYY-MM-DD`), metric, value, unit, source?, updatedAt                                                                   | `by_metric_date`, `by_date`                |
| `healthBuckets`    | metric, hour (epoch ms), count, sum, min, max, unit                                                                            | `by_metric_hour`                           |
| `healthSamples`    | metric, value, time, unit, source? (raw, pruned at 30d)                                                                        | `by_metric_time`, `by_time`                |
| `healthWorkouts`   | externalId, type, start, end, duration, distance?, activeEnergy?, avgHeartRate?, maxHeartRate?, elevation?, source?            | `by_start`, `by_type_start`, `by_external` |

**Prefix rule:** an index whose fields are a prefix of another is redundant —
bind only the leading fields of the longer one. `by_url` and `by_url_deleted`
on `comments` are gone for this reason: hard delete only sets `deletedAt`, so
tombstones stay forever, and every read binds `url` and `.eq('deletedAt', null)`
on `by_url_deleted_parent_score` to skip them at the index rather than filtering
in JS.

`createdAt` is Convex's built-in `_creationTime`.

Schema changes: edit `convex/schema.js` and run `npx convex dev`. There are no
migration files.

---

## Articles (`src/lib/article/`, `src/lib/content/`)

### The language is the URL

Korean is the bare URL (`/blog/us-camp`), English is `/en` (`/blog/us-camp/en`):
an optional `[[lang=lang]]` param, matched by `src/params.js` (SvelteKit 3:
one module, `defineParams`, a matcher returns the value or `undefined`). The
rules — which language is primary, which URL each lives at, what a URL resolves
to — are `#lib/content/article-paths.js`, shared by the server and the browser.

- **Every article is prerendered**, at both URLs (`entries` in each route's
  `+page.server.js`, which exports nothing else). `/en` exists even for a
  Korean-only post: it renders Korean with `canonical` pointing at the bare URL,
  which is what lets the cookie redirect send anyone there blind.
- **Each language has its own canonical, `og:url`, `hreflang` set and sitemap
  `<url>`.** The old `?lang=en` pages declared the Korean page canonical, which
  made every English page a duplicate to a search engine.
- **The `preferred-lang` cookie only remembers the visitor's choice.**
  `vercel.json` redirects a direct visit to the bare URL to `/en` (307), and
  `?lang=en` permanently; the universal load does the same for a link followed
  inside the site, where no request is made. The redirect's `:slug` is
  `[a-z0-9-]+` on purpose: `/blog/__data.json` matches `/:kind/:slug` too.
- **Switching is a `goto(…, { replace: true, reset: false })` within the same
  route**, so `Article` stays mounted and the content still slides across. The
  route wraps it in `{#key data.slug}`: a different article is a new component,
  never a language swap between two posts. The outgoing language keeps
  rendering from `seen` through its exit transition.
- **Likes and comments are keyed by `data.articlePath`** (the bare URL), so both
  languages share them. **The layout's canonical reads `data.canonicalPath`.**
- **English content links to other articles' `/en` URLs**, and same-page anchors
  are `#id`, not `/blog/x#id` — the prerender crawler fails the build on the
  latter (`prerender_missing_id`), because `/blog/x` is the Korean page.
- `<html lang>` comes from `pageLang` (`server/page-lang.js`), called from
  `hooks.server.js` — it has to be right in the prerendered HTML.

### One component, one load

`Article.svelte` is a blog post or a project page: the language state machine,
the shared head tags, the header and the body. Each route passes its head tags
(`head`), header pieces (`eyebrow`, `dateline`, `intro`, `aside`) and `footer`
as snippets; a line of header text that changes with the language is a
`SwapLine`. `articleLoad(kind)` (`article-load.js`) is the one universal load.

**There is no server load, and there must not be one.** It would put a function
round trip (`iad1`, over a second cold) in front of every client-side
navigation, before the content chunk could even be requested. The load needs:

- **`/api/articles.json`** (prerendered, `server/article-index.js`): which
  languages each article has, and each post's series lists. Read once per
  browser session. It exists because the load must not import content chunks to
  find this out — see "Content Lists".
- **One content chunk**, the language in the URL. The other is preloaded at idle
  after mount, so a switch never waits.

**`ipHash` is served by `GET /api/visitor`** and held in `#lib/visitor.svelte.js`,
requested once per browser session and never awaited. Do NOT move it into a load:
the pages are prerendered, so it would be the build machine's hash.

**A post renders on click without touching the network.** The listings carry
`data-sveltekit-preload-code="viewport"` for the route's JS, and they and
`SeriesList` carry `use:preloadArticles` (`#lib/content/preload-articles.js`)
for what the load waits on: the index and the content chunks. Both read the
globs in `#lib/content/article-modules.js`, so they are the same chunks.
Measured under Fast 3G: 60–95ms from click to rendered post, with only
`/api/visitor` going out, unawaited. Keep it that way: anything a load awaits
has to be preloaded too, or it is back on the click's critical path. Not
`preload-code` on `SeriesList`: the current post's row has no `href`, and
SvelteKit's viewport observer throws `new URL('')` on it.

**What arrives after the post, and how Convex sees it:**

- `LikeButton` subscribes with `ipHash: ''` until the hash lands (the count is
  the same for everyone, and that query is shared in Convex's cache), then
  re-keys. `countReady` keeps the count on screen across that swap; only the
  heart waits.
- `CommentsSection` passes `'skip'` until the hash is known: every comment
  carries this visitor's vote, so a list read without it would be read twice.
- The hash is cached for the session, so `/api/likes` and the vote endpoint
  return the `ipHash` they wrote under and the components `adoptIpHash` it. A
  visitor whose address changed mid-session (Wi-Fi to cellular) otherwise
  reads under one identity and writes under another, and the heart never sees
  its own like come back.

**Locally, aborted chunk requests are the placeholder Convex URL**, not the
code: the Convex client's fatal parse error intermittently aborts every
in-flight request, and a failed `import()` stays failed, so a navigation lands
on `+error`. Build with a parseable `PUBLIC_CONVEX_URL` before measuring.

---

## Authentication & Admin

- **`ADMIN_SECRET`** in env. `verifyAdminSecret(request)` accepts either the
  `x-admin-secret` header or the `admin_token` cookie.
- **Page auth:** `routes/admin/+page.server.js` checks the password with
  `secretsMatch` (HMAC, constant-time) and issues a signed
  `expiresAt.nonce.signature` token as an httpOnly, sameSite=strict cookie for
  24h. The secret never reaches the page — `load` returns
  `{ authenticated, sessionToken }`, and the token is the cookie's own value.
- All `/api/admin/*` routes require the header and return 401 otherwise.
- Convex mutations take an optional `adminSecret`; when valid it bypasses rate
  limits and per-IP checks.

### Two admin credentials, because the dashboard subscribes for itself

The dashboard reads Convex over the websocket (see Realtime Queries), so the
browser needs something to authenticate with, and **`ADMIN_SECRET` is not it** —
it is the master key, it bypasses every rate limit and per-IP check, and it never
expires. The session cookie is: scoped, 24h, revocable.

So `load` also registers that token with Convex (`adminSessions.ensure`, which
holds only its SHA-256) and hands it to the page. `assertAdminAccess` in
`convex/lib/adminSession.js` takes either credential — the server routes send
`adminSecret`, the dashboard's own subscriptions send `sessionToken`. **Only the
three admin _queries_ take the session token** (`admin.listUrls`,
`admin.listForUrl`, `bans.list`); every write still goes through `/api/admin/*`,
where the real secret stays.

- **Expiry is a document deletion, not a clock read.** A query is not rerun
  because time advanced, so an `expiresAt > Date.now()` check inside one would
  keep streaming from a cached result past the deadline. The row is deleted by a
  `scheduler.runAt(expiresAt, …)` job instead; `ensure` also sweeps stale rows as
  a backstop, which it may do because it is a mutation. Reading the row puts it
  in the query's read set, so the delete is what invalidates the subscription.
- **Sign-out revokes.** `logout` deletes the row before the cookie, so a tab left
  open elsewhere loses its subscriptions at once rather than at the token expiry.
- **`ensure` must stay idempotent.** `/admin`'s load calls it on every visit, and
  re-patching the row would push a websocket update to every open dashboard for
  no change at all — the same trap as the feed rows.
- The trade this makes: the token is readable by JS on `/admin` rather than
  httpOnly-only. It buys read access to comment/ban data for at most the
  cookie's own lifetime, where `ADMIN_SECRET` would buy everything forever.
  `convex/adminSessions.test.js` covers the whole surface.

---

## Client IP (`src/lib/server/ip.js`)

The site is proxied through **Cloudflare**, so the connection Vercel sees — and
reports as `x-real-ip` — is a Cloudflare edge, a different one from request to
request (measured: one client, six requests, five hashes). `getClientIp` takes
`cf-connecting-ip` **only when `x-real-ip` is inside Cloudflare's published
ranges**; a request straight to the Vercel domain can set the header but not the
source address. Every `ipHash` — likes, votes, bans, rate limits — hangs off
this. If Cloudflare publishes new ranges, update the lists.

## Rate Limiting

Inside Convex (`convex/rateLimits.js`), keyed on `ipHash`, so limits survive
SvelteKit cold starts and apply to direct Convex mutations too. Admin requests
with a valid `adminSecret` bypass everything. A rejected limiter throws;
`convexErrorToResponse` in `src/lib/server/api.js` maps that to a 429 with
`Retry-After`.

**Only the SvelteKit server may say whose `ipHash` it is.** `likes.setLike`,
`comments.create`, `comments.vote`, `comments.checkCanCreate` and the comment
owner actions (`commentActions.editComment`, `softDeleteComment`) are public
Convex functions (the URL ships in the client bundle) that key bans, limits,
like dedup and the password-attempt limit on the hash they are handed, so each
requires `serverCredential`:
HMAC-SHA256 of `convex-server-call` under `ADMIN_SECRET`, derived by
`src/lib/server/convex.js` (Node crypto) and `convex/lib/serverCall.js` (Web
Crypto). `src/lib/server/convex.test.js` pins the two to the same string. It is
not `ADMIN_SECRET` and bypasses nothing.

**One gate, one list.** Each such function takes `visitorWriteArgs` and starts
with `beginVisitorWrite` (`convex/lib/visitorWrite.js`): server credential, then
the admin bypass, then the ban; it returns the limiter to `spend` from once the
write is certain (`check` for `checkCanCreate`, which must refuse exactly what
`create` would). On the SvelteKit side `visitorArgs(request)` /
`adminArgs(request)` (`src/lib/server/callers.js`) build those arguments.
(`commentActions.softDeleteComment` takes only `ipHash` and `serverCredential`:
a visitor's delete never inspects admin auth — see Comment Deletion Semantics.)
`SERVER_CALL_FUNCTIONS` in `serverCall.js` names them;
`convex/serverCall.test.js` checks it against every public write that takes an
`ipHash`, and the Convex test helper (`setupConvex` in `src/test/convex.js`)
and the e2e fake read it. A new public function that trusts an `ipHash`
argument takes `visitorWriteArgs` and goes on that list.

**Error kinds** are `ERROR_KINDS` in `convex/lib/errors.js` (thrown with
`fail(kind, message)`); `convexErrorToResponse` maps the same table to HTTP
statuses, and always answers with a `Response`.

## Content-Security-Policy (`vite.config.ts`)

Enforced, through SvelteKit's `csp` config in `mode: 'auto'`: prerendered pages
carry it as a `<meta>` with SvelteKit's inline bootstrap hashed, rendered pages
(home, `/now`, `/health`, `/admin`) as a header with a nonce. **Not `'hash'`
mode:** `/health` streams, and SvelteKit writes each streamed chunk as an inline
script after the header has gone out.

- **The only inline script of our own is `app.html`'s theme script**, allowed by
  a hash computed from the file at build time. Do not add another inline script
  or an inline event handler (`onload=` …) to `app.html` — put it in that one.
  It flips the deferred font sheet (`link[data-defer-css]`) to `media=all` for
  exactly this reason.
- **A new origin needs a line in the directives**: an image host, an embed, an
  API the browser calls. `npm run test:e2e` fails on any violation it meets.
- `style-src` keeps `'unsafe-inline'` — Svelte writes `style` attributes.
- **No action or event listener on an `<img>`.** Svelte then renders
  `onload="this.__e=event"` / `onerror=…` into the markup to replay events that
  fire before hydration, and the CSP refuses both. Listen from a container
  instead (`hideBrokenImages` catches `error` in the capture phase). The e2e
  scrolls every page to its foot so lazy images meet the policy.

---

## API Routes

### Public

| Method | Route                     | Auth     | Description                                   |
| ------ | ------------------------- | -------- | --------------------------------------------- |
| GET    | `/api/comments?url=`      | —        | Comments + vote counts for a page             |
| POST   | `/api/comments`           | —        | Create (ban check, rate-limited)              |
| PATCH  | `/api/comments/[id]`      | password | Edit own comment (bcrypt)                     |
| DELETE | `/api/comments/[id]`      | password | Soft-delete: text+username become `[deleted]` |
| POST   | `/api/comments/[id]/vote` | —        | Toggle up/down vote                           |
| GET    | `/api/likes?url=`         | —        | Count + whether current IP liked              |
| POST   | `/api/likes`              | —        | Toggle like                                   |
| POST   | `/api/now`                | admin    | Update `/now` content                         |
| GET    | `/api/visitor`            | —        | `{ ipHash }` for this visitor, no-store       |
| GET    | `/api/articles.json`      | —        | Prerendered: languages + series per article   |

### Admin (`x-admin-secret`)

| Method | Route                             | Description                                |
| ------ | --------------------------------- | ------------------------------------------ |
| GET    | `/api/admin/comments`             | URLs with comment counts                   |
| GET    | `/api/admin/comments?url=`        | Full comment list for a URL (incl. ipHash) |
| POST   | `/api/admin/comments/[id]`        | Set/clear admin reply                      |
| DELETE | `/api/admin/comments/[id]`        | Hard-delete (sets `deletedAt`)             |
| DELETE | `/api/admin/comments/[id]?soft=1` | Soft-delete                                |
| GET    | `/api/admin/bans`                 | List banned IPs                            |
| POST   | `/api/admin/bans`                 | Ban the IP behind a comment                |
| DELETE | `/api/admin/bans/[id]`            | Unban                                      |

`/api/og/test` is a fixture gallery gated behind `__DIALS__`.

---

## Realtime Queries

Public surfaces (CommentsSection, LikeButton, `/now`, the home page's Now
Listening and Photos) subscribe via `convex-svelte`'s `useQuery`.
`setupConvex(PUBLIC_CONVEX_URL)` runs once in the root layout. No subscription
gates a page render — each section renders its own skeleton off `query.isLoading`.

**CommentsSection and LikeButton pass `keepPreviousData: true`**, which also
retains the _previous page's_ result across a client-side navigation. Both gate
rendering and every write on `freshFor(path, result).current`
(`#lib/article-visitor.svelte.js`), keyed on the article's path. Any new
`keepPreviousData` subscription needs the same guard, or visitors can act on the
page they left.

**The admin dashboard subscribes too** — `admin.listUrls`, `bans.list` and
`admin.listForUrl` — with the session token described under Authentication &
Admin. Consequences worth knowing:

- **Nothing on that page refetches after a write.** Replies, bans, deletes and
  unbans go out through `/api/admin/*` and come back down the websocket, so
  `AdminCommentNode` has no `onChange` prop and the page has no reload helpers.
  A comment posted by a visitor appears without a refresh, which is the point.
- **`listForUrl` is subscribed only while a post is open** (`'skip'` otherwise).
  One URL's thread is the only one the screen can show; every other subscription
  would be websocket traffic for something nobody is looking at.
- The stat tiles read the same live lists, so they are no longer stuck behind
  whichever tab happens to be open.

---

## Comment Deletion Semantics

- **Soft delete** — sets `text` and `username` to `[deleted]`. The row stays, so
  thread nesting is preserved. **That text is the only record of it**
  (`convex/lib/commentRules.js`, which also holds every comment limit the Zod
  schemas and the forms import), so `create`, `applyEdit` and the Zod schemas
  refuse it as a comment's whole text, and `applyEdit` refuses a soft-deleted
  comment — the password hash survives the delete.

  The public `DELETE /api/comments/[id]` **always** soft-deletes and never
  inspects admin auth. The site owner browses their own posts holding an
  `admin_token` cookie, so branching on admin there turned an ordinary
  visitor-side delete into a hard delete of the whole subtree.

- **Hard delete** — sets `deletedAt`, excluded from every public query at the
  index (`deletedAt` is bound to `null`). Children keep their `parentId` and surface as "stray"
  in the admin tree, rendered with an amber badge by `buildTree()`.

  A hard delete walks the subtree in batches of 200. **The continuation resumes
  from the frontier the previous batch did not reach, not from the root** — it
  is handed that frontier as a scheduler argument. Restarting at the root
  re-issued a `by_parent` query for every already-retired node, so the reads to
  delete a thread grew with the square of its size.

---

## Denormalized Counts

Four counters are stepped by a delta, never recomputed:

- **`comments.upvotes` / `downvotes`** — moved by what the vote toggle actually
  changed. **Do not "fix" this back to a recount.** Convex mutations are
  serializable transactions, so a read-modify-write cannot lose an update; the
  recount read every vote row on the comment per vote, and widened the read set
  in a way that makes OCC conflicts _more_ likely.
- **`commentUrlCounts` / `likeCounts`** — one `adjustCount(ctx, table, url,
delta)` per distinct URL. Every comment in a subtree shares a URL, so stepping
  by one meant 200 reads and 200 patches of a single row in one transaction.
  `applyCountDeltas(ctx, table, deltas)` (`convex/lib/counter.js`) takes a
  `Map<url, delta>`.

`convex/votes.test.js` checks every path through the toggle against a full
recount. Keep those tests — they are the only thing between a delta bug and a
count that is silently wrong forever.

A **sharded counter** is the wrong tool here and was considered: it solves write
contention this site does not have, and `count()` reads all 16 shards, so
`likes.get` — which runs on every page view — would go from one read to sixteen.
It also cannot enumerate keys, which `admin.listUrls` needs.

---

## Home-Page Feeds (`convex/feeds.js`)

Now Listening (Last.fm) and Photos (`photos.injoon5.com/feed.json`) are pulled
by a Convex cron every 5 minutes. One action per feed, so one being down does not
hold back the other. Each normalizes the response down to what the page renders
(`convex/lib/feeds.js`) — the raw payloads are ~20x larger.

- **A failed or empty upstream response throws instead of writing**, so the page
  keeps showing the last good feed. `convex/feeds.test.js` asserts this.
- **An unchanged feed is not written either.** Convex invalidates on the
  document, so re-patching an identical row pushed a websocket update to every
  open home page 288 times a day per feed. `sameFeedRows` compares first and the
  mutation returns `{ changed: false }`.
- Needs `LAST_FM_PUBLIC_API_KEY` in the Convex env (`npx convex env set`).

**The home page bakes both feeds into its HTML** with Vercel ISR
(`config.isr.expiration: 300` in `routes/+page.server.js`), and seeds the live
subscriptions with that data through `useQuery`'s `initialData`, so the server
render and the first client render are the same markup. A slow Convex yields
`null` after 3s and the page loads the feed live instead.

- **ISR cost, checked against Vercel's limits:** stale-while-revalidate, so a
  visitor always gets a cached page; at most ~8,640 regenerations a month, and
  an unchanged page costs no ISR write (Hobby: 200k writes, 1M reads). Each
  deployment starts with an empty cache, and `adapter-vercel` ignores ISR on a
  prerendered route, so the first request after a deploy renders synchronously.
- The adapter caches the HTML and `__data.json` together, and lets no query
  string but `__pathname` into the cache key.

## `/now`

Rendered the same way as the home page: ISR every 5 minutes, the markdown turned
into HTML on the server, and the live subscription seeded with that data.

- **One renderer for both sides**, `#lib/now/render-markdown.js`: marked, with
  raw HTML shown as text and a link or image URL kept only for http(s), mailto or
  this site. Those are the only two ways markdown reaches script, so they are
  closed rather than sanitized after the fact — there is no DOMPurify (it needs a
  DOM the server does not have). The browser loads the renderer only when the
  content changes while the page is open, i.e. after an edit.
- **"Updated …" is an absolute date until mounted.** The ISR render cannot know
  when it will be read; a relative time baked into it would be wrong, and the
  client's would differ from it.
- **The Edit button checks `/api/admin/whoami` only for a browser holding the
  `admin_hint` cookie**, which `/admin` sets beside the real httpOnly
  `admin_token` and clears on sign-out. It grants nothing — whoami still checks
  the real cookie — it only spares every visitor a function call.

---

## Content Lists

`src/lib/server/content-modules.js` holds the eager metadata globs, and
`src/lib/server/catalogue.js` turns them, once, into every published article
(its languages, primary first, and its metadata in each, newest first). The
listings, the article index, series, sitemap, RSS and the like/comment URL
guard all read the catalogue; none of them walks the globs. In the globs **both
halves of the options matter**:

```js
import.meta.glob('/src/content/blog/en/*.md', { eager: true, import: 'metadata' });
```

- `import: 'metadata'` yields the records rather than module namespace objects.
  Rollup cannot drop exports it can't see through a namespace object, so without
  it the compiled Svelte component for every post rides along.
- **The options object has to be written out at each call.** `import.meta.glob`
  is a compile-time transform, so hoisting it into a shared `const` silently
  falls back to a _lazy_ glob whose values are import functions. Nothing throws —
  `metadata.published` is `undefined` on a function — so every post reads as
  unpublished and the RSS feed, the listing APIs and the valid-URL guard all
  quietly go empty. **This has happened once.** After a build, check
  `.svelte-kit/output/prerendered/pages/rss.xml` has `<item>` entries.

**Never glob the same `.md` eagerly and lazily in one bundle.** A module
imported both ways cannot be split, so Rollup puts every whole post in a static
chunk. `blog/[slug]/+page.js` did this to read `metadata.series` and every
article page loaded every post's compiled content — 48KB gzipped, drafts
included. The series lists are now `seriesBySlug` (`server/series.js`), served in
`/api/articles.json`; the universal load keeps only the lazy glob.

Listing pages read `publishedPosts()` / `publishedProjects()` directly in a
server load. `/api/posts` and `/api/projects` still exist as public endpoints,
but are no longer how the site's own pages get the list.

---

## Input Validation (`src/lib/server/validation.js`)

| Schema                | Key fields                                                        |
| --------------------- | ----------------------------------------------------------------- |
| `createCommentSchema` | url, username (max 32), password (min 4), text (1–200), parentId? |
| `editCommentSchema`   | text (1–200), password (min 1)                                    |
| `voteSchema`          | voteType: `'up'`\|`'down'`                                        |
| `likeSchema`          | url, liked (the desired state)                                    |
| `replySchema`         | reply (max 1000)                                                  |
| `banSchema`           | commentId (Convex id), reason? (max 500)                          |

---

## Lightbox and Gallery (`src/lib/lightbox/`)

`Lightbox.svelte` orchestrates; the logic lives in modules beside it —
`geometry.js` (sizing, paging and settle maths, unit-tested without a DOM),
`spring.js`, `velocity.js`, `flight.js`, `modal.js`, `store.svelte.js`.

**Its state is three enums, not a row of flags.** `phase` (closed, open,
closing, dismissing), `flewIn` / `flyingHome` (none, photo, photo+bottom), and
`gesture` (idle, pressed, x, y, pan, pinch, wheel). The CSS classes
(`.closing`, `.flew`, `.bottom-flew`, `.dragging`…) are derived from them. The
store effect runs its resets under `untrack`: they read `gesture`, and
tracking it reset every gesture as it began.

**The lightbox opens groups, not images.** `lightboxAction` looks for a
`[data-lightbox-group]` ancestor: inside one, the whole group opens at the
clicked index; outside one it is a group of one. The grouping is declared in
markup rather than guessed from sibling images, so an article of unrelated
screenshots doesn't become a slideshow.

Per-image opt-outs on the `<img>`: `data-no-lightbox` excludes it,
`data-lightbox-src` points at a larger file, `data-lightbox-caption` overrides
the alt text. The source comes from the `src` attribute, not `currentSrc` —
on a `srcset` image that is whatever the browser picked for the _thumbnail_.

**A `srcset` travels with the image.** The lightbox's `<img>` carries the
article's `srcset` against its own `sizes` — the full-screen box's width, and
the box times `MAX_SCALE` once zoomed — so it fetches a screen's worth, never
the original, and zooming swaps a sharper copy in (the browser keeps the
current one on screen until the new one has decoded). The article's copy is
still the `poster` painted underneath while that loads. **`naturalWidth` is not
the file's width on a `srcset` image**: `w` descriptors make it the file divided
by its density against `sizes`. Item sizes come from the build's
`width`/`height`, and `fileSize()` (`image-cache.js`) reads the chosen
candidate's descriptor wherever a file's real size is wanted.

### It opens as the same photo, not a new one

The image **flies from the box it holds in the article to the box it holds
full-screen**, and back to wherever that image sits when you close.

- The page copy is hidden with `visibility` (not `display`, which would reflow
  the article and destroy the box the flight is aimed at) for as long as the
  lightbox shows it.
- **The flight is a WAAPI animation**, not a class or an inline transform: it
  runs off the main thread, and Svelte rewriting the `style` attribute
  mid-flight cannot wipe it out.
- **One uniform scale**, never separate scaleX/scaleY — both ends are
  `object-fit: contain` around the same file.
- **Closing realigns the scroller first** (`alignOrigin`), so closing on the
  fourth image of a strip lands on the fourth image. It never touches page
  scroll, which is locked.
- Falls back to a scale-and-fade when it cannot fly: no origin element, no
  natural size, a zoomed image, an origin still off-screen after aligning,
  reduced motion, or no layout (which is what keeps jsdom happy). **Two flags:**
  `flew` suppresses the stage's entrance for the whole open, `flying-home`
  suppresses its exit only while a flight home runs.
- **The flights are springs** — `springEasing` writes a damped oscillator as a
  `linear()` easing so WAAPI still runs it on the compositor. Bounce 0.25 in,
  0 coming home (past the mark would be past the slot the photo belongs in).
  There is a `cubic-bezier` fallback.
- The caption slot is **held open across the group** at the two lines it clamps
  to, whenever any image is captioned: the chrome's height reserves room for the
  photo, so a caption wrapping where its neighbour did not resized the photo
  mid-slide.
- Shadow and rounded corners are shed on the way home, and the page's copy is
  handed back from the flight's `onfinish` rather than the portal's teardown, so
  the swap is invisible.
- **The caption travels with the photo.** A captioned image already has that line
  on the page — `rehype-figure`'s `<figcaption>` for an article image, the
  strip's own for a gallery — so the lightbox's caption flies from it on open and
  back to it on close, measured in the same read blocks as the photo's flight.
  A **translation and nothing else**: the two are the same family at the same
  14px and the same weight, and scaling type is the one part of a shared-element
  move that always goes soft.
  **The type is measured, not the boxes.** The lightbox holds two lines' worth of
  room open across the group, so a one-line caption sits in the top half of its
  slot — centring the boxes landed the words 10px above the page's own. A `Range`
  around the contents is the line itself, and it stays right for two lines too.
  **It changes voice rather than fading.** The only difference between the two is
  colour: the page's line is grey on the article, the lightbox's is white over a
  scrim with a shadow under it. So the copy leaves wearing the page's own voice
  and takes the lightbox's on as the backdrop arrives, putting it back down as the
  backdrop goes. Both are read off `getComputedStyle`, so dark mode needs no
  second answer, and `none` is not interpolable — the page end is the lightbox's
  own shadow with the colour taken out.
  That is what lets it hold **full opacity for the whole flight in both
  directions**: it is legible at both ends and every point between, it starts and
  lands with the photo, and at the page end it is pixel-identical to the line it
  came from — which makes hiding that line a swap, exactly like the photo's, and
  not a flash.
  **The window is the backdrop's, not the flight's.** Measured, the scrim is 55%
  in by 33ms of an open and 88% _gone_ by 67ms of a close, while the spring's own
  progress at 17ms is 5.8% — so keying the voice to travel lags the light. It
  changes over the first 12% going out and the first 35% coming home. White type
  left on a bright article is the whole failure mode: its dark halo is all that
  shows, and it reads as a grey smear following the photo home.
  `restingCaption` cancels whatever is on the caption before it is measured: the
  per-slide reveal is a `both`-filled CSS animation, in effect from the moment
  the element is styled, and an interrupted open flight is still on it. Paging
  keeps that reveal — a caption arriving mid-group has no page-side line to come
  from, and its blur is 2px: at 14px a radius that would be a soft focus on a
  photograph pulls the glyphs apart, and blurs the `text-shadow` into them until
  white type and its dark halo average out to grey mush.
  `restoreOriginCaption` runs from the photo flight's `onfinish`, beside
  `showOrigin`, and from the portal's teardown for the close that never flew.
- **The stepper travels too.** It is the same indicator for the same group in
  two places, and both are the same row of pills — neither side overrides
  `--pill-dot-size`, `--pill-active-width` or `--pill-gap` — so the lightbox's
  flies to and from the strip's on the photo's own curve. The capsule is
  measured, not the box around it: the strip's wrapper spans the article's width
  and the lightbox's shrinks to its pills, and centring _those_ puts the row
  1.5px out.
  **Its hand-over is a crossfade where the caption's is a swap.** What separates
  the two is a palette, and a palette is custom properties, which do not
  interpolate unless registered — and which pasito's own 500ms `background`
  transition would chase if they did. **The dissolve has to wait until the two
  are on the same spot:** this spring spends its last 7% of distance over 75ms,
  so at 90% the two rows are 11px apart and dissolving through each other reads
  as a smear. It runs over the last 3% going home (under 4px) and the first 6%
  going out. `data-lightbox-steps` is the whole contract: neither component
  imports the other, the same way the header is told to raise itself.
  The strip's row also has to stay down while the **caption's** glyphs cross it —
  measured, they are over the dots from 100ms to about 170ms of a 260ms trip home,
  and a row of pills punched through the middle of the type is the whole of what
  that looks like. It clears at 92%, which the 97% hand-over sits safely after.
  **`.lb-caption-slot` carries a `z-index`** because `Stepper` is positioned, and
  a positioned element paints above the inline text of a sibling that is not,
  whatever the DOM order says — so the same trip went over the page's pill row
  and under the lightbox's own. It is one line of type moving: it belongs on top
  of both.
- **The chrome's fade cannot be over the pieces that fly.** The caption
  lives inside `.lb-chrome`, which fades in as a whole a beat behind the photo
  (and out over 200ms of a 260ms flight home) — and opacity multiplies down, so a
  parent at zero cannot be argued with from the child. The caption was invisible
  for the first 90ms of its flight. On a phone that is 25px of travel and nobody
  sees it; on a wide screen the path is ten times as long and the missing stretch
  is exactly the part that crosses the photo, so the line appeared to come out
  from _behind_ the picture. `.bottom-flew` / `.bottom-flying-home` take the
  fade off the chrome and give it to the pieces it was always for — the controls
  and the two scrims — so the caption's own opacity is the only one over it, and
  that one never leaves 1. A class is enough here, unlike the stage's entrance:
  this only has to be true by the first _paint_, not by a measurement a flush
  earlier.

### Nothing may be in effect on the box the flight is measured against

Both ends are measured with `getBoundingClientRect`, which reads through every
ancestor transform and reports the box as it stands _at that instant_. The flight
then animates a transform relative to a layout box it assumed was final. Anything
that changes that box afterwards offsets the whole flight, and its first frame —
the one that is supposed to sit exactly on the thumbnail — is where it shows.

Two things had to be taken out of the way in `portal`, in this order:

- **The stage's own entrance.** `lb-in` starts at `scale(0.92)`, and a CSS
  animation with a backwards fill is in effect from the moment the element is
  first styled. The photo was measured through it and `flew` then took the
  entrance away, so the flight's first frame painted the photo **8% larger than
  the thumbnail it was leaving** — 1/0.92 exactly. `startOpenFlight` cancels the
  stage's animations before measuring; `flew` is a state change and lands a flush
  later, which is too late to measure against.
- **The chrome's reserved height.** `bottomH` comes from `bind:clientHeight`,
  i.e. a ResizeObserver, which does not run until the frame's rendering step —
  after the action, though still before paint. So the box measured in the action
  is one with no room reserved for the caption, and the photo moved half the
  difference (8px on a phone) out from under a flight already measured against
  it. `settleChromeReserve` reads the chrome and writes the reserve onto the node
  first. It can do that because everything downstream of `bottomH` is a
  `$derived`, and those are pull-based: they read as the values the next flush
  will render the moment it is assigned. `flushSync` is not an option here —
  Svelte throws on it inside an effect, and an action is one.

Anything else added between the photo's box and the viewport has to be settled in
the same place. `Lightbox.svelte.test.js` cannot catch this: jsdom has no layout,
so the flight never runs.

### The page's own chrome has to get above it, at one exact moment

The header is `position: sticky`, and the box a photo flies home to is routinely
underneath it. A dialog at `z-index: 9999` draws the photo **over** the bar for
the whole flight and then the page takes it back **under** the bar in one frame,
slicing the top off it at the moment the eye has followed it there.

The rule is: **the header is above everything except an open lightbox.** The
lightbox hands it the top of the stack by setting `data-lightbox="returning"` on
`<html>`, which `NavBar` answers with a `z-index` and nothing else. Neither
component imports the other, and the header does not move, fade or change in any
way — it is a paint order.

**The swap is timed off the photo's box, not off a clock.** It happens on the
frame the photo's top edge reaches the reserved band, which is the last frame on
which the two do not overlap at all — so there is nothing to see, at any scroll
position. Waiting for the scrim to fade instead loses the race exactly where it
matters: measured, a photo whose article box sits 200px under the header is
already 90px across the bar by the time the backdrop is gone, and 230px at 400px
under. The cost is one `getBoundingClientRect` per frame of one 260ms animation.

- **The band is asked for as a depth, not as a header**, so the lightbox still
  knows nothing about what is up there: the root's used `scroll-padding-top`, the
  page's own statement of what a `#hash` target must clear. Not `--nav-h`
  directly — a custom property is a token, and until `NavBar` republishes it in px
  it computes as `3.5rem`, which `parseFloat` reads as **3.5**. That put the swap
  52px inside the bar. The used length is the header plus 1rem, so the swap lands
  just _before_ the photo reaches the bar — the only direction that is free.
- **Never fade the header to hide it.** Grouped opacity anywhere above
  `.nav-surface` makes a new backdrop root, and its `backdrop-filter` then has
  nothing to sample: the blur dies for the whole fade and snaps back at the end.
  This was shipped once and is very visible against a photo.

### Performance

- **`-webkit-backdrop-filter` goes before `backdrop-filter`, always.** Written
  the other way round the minifier collapses the pair to the prefixed
  declaration alone, and Chrome and Firefox render no blur at all. Every blur in
  the lightbox and gallery had been shipping that way. Check
  `_app/immutable/assets/*.css` after a build if you touch one.
- The blur is the most expensive thing on screen; 8px, not 14px + saturate.
- **The backdrop is two elements.** Fading a blurred one does not fade the blur,
  it reveals the sharp page underneath.
- **One `style:` directive per property**, never one `style` string — a string
  is re-parsed in full every frame of a drag.
- Writes before reads in the release handler.
- `will-change: transform` only on `.lb-img[data-current="true"].zoomed`.

### It is a filmstrip, not a slot

Every image is a slide on one flex track that is translated sideways.

- The track is `position: absolute; inset: 0` and the slides overflow it, so its
  own width stays one page — that is what makes `translateX(-i * 100%)` mean one
  page per step.
- **Only the current slide and its neighbours carry a `src`**, and that window
  is `windowIndex`, which is `index` **one frame late**. Mounting the next
  neighbour's `<img>` in the same commit that starts the page made that commit
  long, so the settle began late. A jump of more than one step catches up
  immediately.
- Chrome lives outside the transform, so a swipe moves the photo and nothing else.

The swipe axis is **locked once**, on the first 8px, and not re-decided per move.
A release pages on **velocity or distance**. Drags past either end get the iOS
rubber band.

### Paging has to feel like the strip in the article

- **The lock threshold is taken back out of the first frame** (`slopX`/`slopY`),
  or the photo sits still for 8px and then jumps 8px.
- **A settle is interruptible.** `pickUpTrack` reads the track's live matrix when
  a gesture takes over and seeds the drag with it. The page decision is made on
  `dragX - carryX` — counting the carry as movement paged on a finger that never
  moved.
- **The settle leaves at the speed the gesture ended at.** `settleSpec` builds a
  duration and an initial velocity; `springEasing` takes that velocity. Capped at
  6, where a critically damped spring starts to overshoot. Duration scales with
  `sqrt(distance / page)` between 190 and 340ms. Non-gesture paging keeps the
  shared curve.
- **Flick velocity is measured over a 60ms window**, not off the last
  `pointermove` — two events 4ms apart on a 120Hz screen make a single-sample
  velocity mostly noise.
- **A trackpad swipe moves the track under the fingers.** macOS momentum keeps
  arriving after the fingers lift and has decayed by the time events stop, so the
  gesture ends on 90ms of quiet and settles where it came to rest.
- **One gesture carries the track one page and no further** (`clampTravel`). A
  finger is bounded by the screen, momentum by nothing, and a settle pages by one
  either way — so a hard flick used to slide five images past and take four back.
  Past the page it will land on, and past either end of the group, it gives a
  tenth of a page and stops. Enough to feel the limit; too little to reveal the
  image beyond it. Only the wheel is bounded — the finger path is already bounded
  by the hand, and its rubber band is tuned as shipped.
- **A long continuous two-finger scroll pages once, not once per page crossed.**
  A native strip would cross several, but only for a real drag: `scroll-snap-stop:
always` stops a _fling_ at the next snap point. A wheel event carries no phase,
  so momentum and fingers-still-down are indistinguishable here — and one page per
  gesture is what the finger drag beside it already does.

Zoom is **one number** (`scale` + `panX`/`panY`). Pan is clamped to the image's
edges, tap and pinch share `panAfterScale`, and the chrome except the close
button fades out while zoomed.

**Full-screen is not `inset: 0`.** The dialog is **portalled to `<body>`** (any
ancestor with a transform, filter or `contain` becomes the containing block for
a fixed child — and that is also the only moment it is provably a body child,
which is why `inert` is applied from the portal action). The root is sized
`100dvh` with the measured `window.innerHeight` as a floor, because on mobile the
bottom of the ICB sits under the collapsing toolbar.

Opening also locks body scroll (with scrollbar compensation) and inerts every
other child of `<body>`, which is what makes `aria-modal` true rather than merely
claimed. Both are released before focus is restored — focus cannot land inside an
inert tree.

**Neither the gallery nor the lightbox upscales.** Plenty of images in these
posts are 200–500px wide. Deliberate zoom is the exception.

The gallery's slides are all **one fixed height** (`--gallery-height`). A swipe
ends in a click, so the track swallows any click whose press started more than
10px away — measured in _page_ coordinates, and only when a pointer actually
began the click.

---

## Steppers (`src/lib/pasito/`)

A Svelte 5 port of [joshpuckett/pasito](https://github.com/joshpuckett/pasito).
Two deliberate divergences: `core.js` is the upstream `core/` directory in plain
JS (which is what lets the windowing and reconciliation be tested without a DOM),
and `Step.tsx` is inlined into `Stepper.svelte` (half of pasito's stylesheet is
descendant rules that would each need a `:global()` hole).

`computeStepWindow`'s `DEFAULT_METRICS` must stay in step with the `--pill-*`
defaults in `Stepper.svelte`.

An entering step has to render collapsed and _paint_ before it is promoted, or
there is nothing to transition from — hence the reconcile in `$effect.pre` and
the two `requestAnimationFrame`s. One frame lands both states in the same paint.

---

## Galleries in Markdown (`src/lib/markdown/remark-gallery.js`)

A top-level paragraph that is nothing but images becomes a `<Gallery />`.
Consecutive lines are one paragraph in mdast, so the run is one the author
grouped by hand; **a blank line between images is the escape hatch**.

A `:::gallery` fence is the explicit form and groups however the images are
spaced, including a single image. The markers are found **inside** paragraph
text, not as nodes of their own.

Three rules keep a typo from eating a post: only images are collected (prose
inside the fence is re-emitted after the gallery), an unclosed fence transforms
nothing, and a fence with no images transforms nothing.

The plugin runs **before rehype**, so `rehype-figure` never sees those images.
The component reaches the compiled markdown through an import spliced into the
file's instance `<script>` — mdsvex does exactly this for its own layout import.
That splice lives in `markdown/splice-import.js` and is shared with
`remarkLazyVideo`: the interesting part is the regexp for "the instance script,
not the module one", and both plugins getting it wrong the same way is the
failure mode.

---

## Videos in Markdown (`src/lib/markdown/remark-lazy-video.js`)

**A top-level paragraph that is nothing but one video reference becomes a
`<LazyVideo />`** — either `![Label](/videos/x.mp4)`, which would otherwise
compile to a broken `<img>`, or `[Label](/videos/x.mp4)`, which would otherwise
navigate away to the browser's bare player. The import is spliced in the same way
the gallery's is, and an author who wrote their own is left alone.

The rule is narrow on purpose: a video is written on its own line, and anything
looser has to decide what a player does mid-sentence. Mixed content stays exactly
as written. It runs **before `remarkGallery`**, which would otherwise collect a
video's image node into a photo strip.

The label is the title, then the alt text or the link text; with none of them the
prop is left off so the component's own default applies.

**A local MP4 is measured at build time** (`markdown/video-size.js`, which walks
the container's box headers to the video track's `tkhd` — the `moov` alone, never
the media data) and `width`/`height` are passed through. `LazyVideo` takes that
shape for both the poster and the player, capped at `--prose-img-max-h` like a
tall photo. It was a fixed 16:9, which played the 800x900 SchoolWatch recording
cropped to its top half. Write videos in the markdown form: a hand-written
`<LazyVideo>` is not measured, starts at 16:9 and corrects itself only once the
file's metadata loads. The authoring extension's drop writes the markdown form.

---

## YouTube in Markdown (`src/lib/markdown/remark-youtube.js`)

A top-level paragraph that is nothing but a YouTube link becomes a
`loading="lazy"` iframe on `youtube-nocookie.com`, built locally.
`[Title](https://youtu.be/…)` names the frame for screen readers; a bare URL gets
YouTube's own default title.

It replaced `@remark-embedder` + its oEmbed transformer, which fetched
oembed.com's provider list and each video's oEmbed on every build — two thirds
of the pipeline's plugin time, a network dependency for predictable markup, and
an eager iframe that loaded YouTube's player with the page.

---

## The mdsvex Pipeline

mdsvex 0.12 parses with its own bundled, pre-micromark `remark-parse`, which
decides what a plugin can do:

- **GFM is built in** — tables, task lists, strikethrough, autolinks.
  `remark-gfm` 4 is a micromark extension that parser cannot load; it was in the
  config and changed nothing in any post, so it is gone. The same applies to any
  micromark-era remark plugin: compile a post with and without it before trusting
  it.
- **Footnotes** come from `remark-footnotes` 2 (3+ is micromark), and mdsvex's
  own mdast-to-hast writes their markup. `rehype-footnotes.js` then finishes it,
  running last: markers numbered in reading order rather than showing the label,
  a unique id per citation (`fnref-1`, `fnref-1-2`) with a back link to each, a
  `<section>` labelled by a visually hidden heading in the post's language, and
  `↩︎` with the text presentation selector, which iOS otherwise draws as an
  emoji. `app.css` sets them under a hairline at the end of the post and marks
  the note or marker a jump lands on.
- **Math** is `remark-math` 3 + `rehype-katex-svelte`. KaTeX's markup is
  meaningless without its own sheet, which nothing loaded until
  `remarkStylesheets` began importing it into the posts that have math. KaTeX's
  fonts are `font-display: block`, so a formula is blank until they land;
  `KatexFonts.svelte`, spliced into the same posts, preloads the Main and
  Math-Italic faces so they are fetched with the sheet rather than after layout.
  `swap` would be worse — fallback metrics make fractions and scripts jump.
  Wait for the fonts before screenshotting, or every glyph is blank.
- **Headings link to themselves the way MDN's do**: `rehype-autolink-headings`
  wraps the heading text in `<a class="heading-anchor">`, and the `#` beside it
  is `::after` content with empty alternative text (`app.css`). It used to be a
  `#` text node, which every copy, reader view and search snippet of a heading
  carried, inside a link that was `aria-hidden` and unreachable by keyboard.
- `gfm-test.md` (unpublished) exercises every one of these; flip its
  `published` locally to look.

Image sizes are read from the first 128KB of each file (`sizeOfFile` in
`remark-image-size.js`), with the whole file as a fallback; reading the photos
in full was most of that plugin's cost on a cold build.

---

## Code Blocks (`src/lib/markdown/code-highlighter.js`)

Fences are highlighted at build time by `@pierre/highlights` (synchronous, Wasm
lexers), so nothing ships to the browser or the Vercel function. Fence meta:
`{1,3-5}` highlights lines, `title="…"` adds a tab, `caption="…"` a
`<figcaption>`, `showLineNumbers` numbers it.

- **A token is a class, the palette is a stylesheet.** Highlights names each
  token's category (`var(--code-keyword)`); `code-theme.js` maps every distinct
  light/dark colour pair to a short class (`t0`…`t22`), and the generated
  `code-theme.css` defines each under the `.dark` class. That halved the markup,
  which ships twice — in the HTML and in the post's compiled JS. Do not switch
  to an inline default colour: the server cannot know the theme, and a client
  re-render would be a hydration mismatch.
- **`code-theme.css` is generated and checked in.** `npm run code-theme` after
  bumping `@pierre/highlights`; `code-theme.test.js` fails until you do, because
  the highlighter derives the same classes at build time.
- **Only posts with code load it.** `remarkStylesheets` splices
  `import '#lib/markdown/code-theme.css'` into those posts, through
  `splice-import.js` like the gallery's component import.
- **Highlights has no language detection.** An unknown label falls back to
  `plain` rather than throwing, and its lexers classify some tokens differently
  from TextMate grammars.
- **The `<pre>` scrolls, not the figure**, so the box and the highlight band span
  the full width and the caption stays put. It carries `tabindex="0"` (Safari
  does not make a scroller focusable on its own) behind a `svelte-ignore`: the
  output is inlined as Svelte template source, not `{@html}`, so Svelte's a11y
  checks see it.
- **A blank line is a line containing `\n`.** The lines are grid items, so the
  newlines between them are not what a copy carries: an empty item copies as
  nothing (blank lines vanish) and a space copies as trailing whitespace.
  Checked against the real clipboard.

---

## Images: the box, and loading them once

### The box is reserved before the file arrives

`remarkImageSize` measures every local image at build time — straight out of the
file header (`markdown/image-size.js`: PNG, JPEG, GIF, WebP), not through a
decoder — and stamps `width`/`height`, `loading`, `decoding`, a
`data-img-pending` marker and `--img-w`/`--img-h` onto the `<img>`. Gallery
slides get the same numbers, carried on the node's `data.imageSize`.

- **EXIF orientation is applied.** Browsers rotate a photo before drawing it, so
  a portrait shot the camera stored landscape reserves a _portrait_ box. The
  probe was checked against `sharp` for all 108 files in `static/`. **The first
  Exif segment wins** — XMP rides in an APP1 too, and answering "no orientation"
  for it un-rotated every iPhone photo on the site.
- **`width`/`height` alone are not enough.** The article sizes images with
  `width: auto`, which is what lets a tall photo give up width when it hits
  `--prose-img-max-h` — and an `auto`-sized image the browser has not fetched is
  **0x0 no matter what its attributes say**. So `img[data-img-pending]` in
  `app.css` writes the same three constraints out against the build's numbers:
  the column, the file's own width, and the height cap turned into a width
  through the aspect ratio. Verified in Chromium against the loaded box; it is
  exact, including the tall photo that the height cap decides.
- **`--img-pending-w` is declared on the image, not on `:root`.** A custom
  property's own `var()`s are substituted on the element that _declares_ it, so
  the formula parked on `:root` looks for `--img-w` there, finds nothing, and
  inherits down as invalid. It is named so the gallery — whose scoped
  `width: auto` outranks the global rule — can re-apply it with its own
  `--img-max-h` instead of restating the arithmetic.
- An image with no `--img-w` makes all of it invalid at computed-value time,
  which is `unset`: exactly the layout it had before.

### Smaller copies, chosen by the browser

`npm run optimize-images` (on Vercel, before `build`) also writes WebP copies of
every image under `static/images` — 640/960/1280/1920 below the photo's own
width, plus a full-size WebP when it beats the optimized original — into the
mirror beside it, and `apply-optimized-images` puts them in `static/`
(gitignored: `*.w960.<key>.webp`). `.cache/image-variants.json` maps each
`/images/...` URL to its candidates; `remarkImageSize` turns that into a
`srcset`, and `remarkGallery` hands it to the slide. Measured on `us-camp`: 12.9MB
of images at 1440@2x became 4.5MB; the Sirius screenshots went from 9.6MB to
0.4MB, with the text still sharp.

- **The key in the name is a hash of the source and the settings.** `/images` is
  served `immutable` for a year, so a new photo or a new quality has to be a new
  URL. `image-variants.js` is a turbo input of `build-image-cache` for the same
  reason. `VARIANT_SETTINGS` (the widths and every encoder option) is what the
  step compares to decide an image's copies are current.
- **The three image steps share `scripts/lib/image-cache.js`**: the `.cache/`
  paths, the raster extensions and the fingerprint file's shape.
- **No manifest, or a candidate missing from disk, means no `srcset`** — a dev
  server that never ran the image step serves exactly what it did before.
- **`sizes` is `auto` first** (`image-sizes.js`): every article image is lazy, so
  the browser uses the width it laid the image out at — the height cap makes a
  tall photo far narrower than the column. The fallback is the column measured at
  each breakpoint of the post page; re-measure it if that layout changes.
- **A `srcset` image keeps the placeholder's box after it loads**
  (`img[srcset][style*='--img-w']` in `app.css`). Its `w` descriptors make the
  browser size it from `sizes`, which upscaled a 530px photo to the 699px
  column, and `sizes="auto"` gives it size containment at 300x150 the moment
  `width` is `auto`. The build's box is the one that does not depend on the
  pixels. A gallery slide re-applies it with its own height cap.
- `image-variants.js` hashes, so it is Node-only; anything the browser loads
  takes `sizes` from `image-sizes.js`.

### The lightbox does not download it again

`lightbox/image-cache.js` is the shared record of what this page has loaded,
keyed by URL. Every `<img>` that lands reports itself (`trackImage`, which also
clears the placeholder — including for an image that finished before hydration
reached it, which fires no `load`).

The lightbox cannot reuse the article's element — it flies from it and back to it
— so the same photo is on screen as two elements, and the browser is the only
thing keeping that from being two downloads. It visibly was not enough on a slow
connection. So:

- **`toItem` seeds the item from what the page already knows**: the natural size,
  else the cache, else the build's attributes. An unloaded image now opens into
  the right box and can be flown to.
- **The article's own pixels are painted under the lightbox's copy** as a
  `background-image` on the same box with the same `contain` fit, until that copy
  decodes. Same URL in every case but `data-lightbox-src`, so it costs no
  request. Measured: opening the lightbox on a loaded photo makes **zero**
  network requests, and with the network cut afterwards the photo still shows.
- The old opacity-0 fade-in is left for the one case with no box at all.
- **Sizes are kept for every URL; decoded elements are bounded** at 24, LRU. A
  photo essay is a hundred images and holding every bitmap is a leak.
- **The "tiny icon" guard measures the same way.** It read `naturalWidth`
  straight off the element, which is 0 while downloading — so every photo in a
  slow-loading article was a 0x0 icon and clicking one did nothing at all.

`/images` and `/videos` are served `immutable` for a year (`vercel.json`). These
files are written once and named by the camera or the screenshot that made them;
a replacement is a new file. Vercel's default is `max-age=0, must-revalidate`,
which costs a round trip per photo per page view.

---

## Apple Health (`/health`)

Data arrives from an iOS Shortcut, is aggregated at write time, and is read back
in ranges sized to the visible window. A Watch produces 1000+ heart-rate samples
a day; reading all of them to draw 24 points is the failure mode the three tiers
avoid.

### Endpoints (Convex HTTP actions, `<deployment>.convex.site`)

All require `Authorization: Bearer $HEALTH_API_KEY`.

| Method | Route              | Description                                                                           |
| ------ | ------------------ | ------------------------------------------------------------------------------------- |
| POST   | `/health/ingest`   | `{ date?, source?, metrics?, samples?, workouts? }` — all keys optional               |
| GET    | `/health/series`   | `?metrics=steps,restingHeartRate&days=90` or `?metric=heartRate&bucket=hour&hours=24` |
| GET    | `/health/workouts` | `?days=90&type=running&limit=50`                                                      |
| GET    | `/health`          | Latest value per metric                                                               |
| GET    | `/health/day`      | `?date=YYYY-MM-DD`                                                                    |
| GET    | `/health/samples`  | `?metric=heartRate&hours=24`                                                          |

Series responses are dense arrays with `null` for gaps and x implied by
`start + index * step`, so dates never ship. Past `maxPoints` (400) days merge
into weeks.

### Rules this code follows

- **Everything is internal**, because a query can't see an HTTP header and there
  is no `ctx.auth` identity here. `api.*` does not appear anywhere under
  `convex/`. The one exception is `convex/healthPublic.js`, which serves only
  what the public page already renders: a fixed metric allowlist arguments
  cannot widen, and only the range picker's own steps.
- **No `Date.now()` in queries.** A query doesn't re-run when the clock moves, so
  a time-derived bound goes stale and churns the cache. The HTTP action computes
  bounds at day or hour granularity and passes them as arguments.
- **No `.collect()`, no `.filter()`** — bounded `.take()` and index conditions.
- **One mutation per ingest**, so day rows, rollups and workouts commit atomically.

### Things that will bite

- **Rollup double-counting.** `appendSamples` does one range read per touched
  hour and folds only _newly inserted_ samples into the bucket. A sample added
  twice can never be backed out. `convex/health.test.js` posts the same 100
  samples twice and asserts `count` stays 100 — keep that test.
- **Step double-counting in Shortcuts.** "Find Health Samples" returns raw
  samples from every source, so summing steps without a `Source is <Apple Watch>`
  filter counts iPhone and Watch separately.
- **Cache granularity.** Keep the range picker coarse (7/30/90/365) — every
  distinct `days` value is a distinct cache entry. The range is client state,
  deliberately not a `?days=` query string.
- **Ingest is capped per request:** 1000 samples spanning at most 12 metric-hours,
  64 metrics, 100 workouts. Over that the endpoint returns 400.

### The Shortcut

Build steps in `shortcuts/README.md`; payloads are checked in at
`shortcuts/payloads/*.json` and replayed by `convex/http.test.js`.
`shortcuts/smoke.mjs` posts them at a live deployment.

**Workouts are not synced.** The ingest mutation, the table and the endpoint all
work and stay tested — Shortcuts just can't build the payload.

### The page (`src/lib/health/`)

- **A gap inside the window is a zero, not a hole.** `zeroFilled()` fills every
  missing day up to a metric's newest reading — a day with no exercise recorded
  is a day with no exercise, and drawing it as a break made a rest day look like
  an outage. Everything _after_ the newest reading is cut instead.
- **The score is the one place a zero is _not_ counted.** `dayScore()` skips any
  metric reading zero, because a Watch on the charger and a day in bed produce
  the same zero. `counted`/`of` drives the dial's "N of 4 metrics" caption. **Do
  not "fix" this to match the charts** — they answer different questions.
- **All four charts share one x domain**, or the shared marker lands in four
  different places.
- **Scrubbing does not use layerchart's tooltip layer** — it re-targets by hit
  test on every pointer move, so on touch a finger dragging toward the edge of
  one chart handed the marker to whichever chart it crossed into. `MetricChart`
  captures the pointer itself and sets `tooltipContext={false}`. This is the
  mobile bug, not a preference.
- **The y axis is text only** — no rule, no ticks, no grid.
- **The SSR load is not awaited.** `+page.server.js` returns the Convex promise
  and SvelteKit streams it. Keep the `{#await}` placeholder matching the real
  grid, or the page shifts when the second chunk lands.

---

## DialKit (preview only)

`src/lib/dev/DialsMount.svelte` is mounted once from the root layout and loads
`DialsHost.svelte`, the single `<DialRoot />` for the site. There is deliberately
no site-wide panel: one meant tuning tokens that only some pages show.

| Panel          | Registered by                     | Moves                                                            |
| -------------- | --------------------------------- | ---------------------------------------------------------------- |
| `Home`         | `lib/home/HomeDials.svelte`       | marquee speed, cover size/gap/scrim, photo columns/count/gap     |
| `Article`      | `lib/article/ArticleDials.svelte` | link underline + offset + thickness, body size, leading, measure |
| `Health chart` | `lib/health/HealthDials.svelte`   | chart geometry and colours                                       |
| `Nav`          | `lib/nav/NavDials.svelte`         | header axis, row spacing, disclosure, chevron, surface, motion   |

Each writes into a `$state` settings module (`*/settings.svelte.js`) whose values
reach the DOM as custom properties. **Every rule that reads one keeps the class's
original value as its fallback**, which is what makes this safe to ship.

`__DIALS__` is a literal baked in by `vite.config.ts` (`VERCEL_ENV !==
'production'`, falling back to `NODE_ENV`). Because it is a literal, Rollup folds
`if (__DIALS__)` to `if (false)` and no DialKit chunk or stylesheet is emitted.

**The guard and the `import()` must stay co-located.** Handing the import to a
shared helper means Rollup can no longer prove it is never called, and the chunk
ships — which is why there are six near-identical `*DialsMount.svelte` files
rather than one parameterised component. Verify with
`grep -ri dialkit .svelte-kit/output/client/` after a build.

Three traps, all already sprung:

- **`VERCEL_ENV` has to be listed in `turbo.json`.** Turbo uses strict env mode,
  so an undeclared variable is _absent_, not merely unhashed. `vite.config.ts`
  read `undefined`, fell through to `NODE_ENV`, and `vite build` sets
  `NODE_ENV=production` — so no panel had ever actually shipped to preview.
  Anything the build reads off `process.env` needs to be in the task's `env`.
- `DialRoot` hides itself when `NODE_ENV` is `production`, and a Vercel preview
  _is_ a production build — hence `productionEnabled`.
- The site-wide controls act through rules injected from `<svelte:head>`, not
  `app.css`, so production carries no trace. They are unlayered on purpose: that
  is what lets the measure rule outrank Tailwind's `.max-w-6xl`.

---

## The Header (`src/lib/nav/NavBar.svelte`)

`position: sticky; top: 0`, in flow, and it never leaves. What it does instead of
moving is read where the page is:

- **`--nav-h` has to be a static value in `app.css`.** It is what
  `scroll-padding-top` is built from; without it a `#hash` link lands its heading
  entirely behind the bar. It cannot simply be measured, because the browser
  scrolls to a deep link while the document is still parsing. `NavBar`
  re-publishes the row's measured height once it has one.
- **The status bar is not ours to paint.** Safari 26 ignores `theme-color`
  outright, and in a tab the page is not laid out under the bar either —
  `env(safe-area-inset-top)` is 0 and `innerHeight` is 714 against a 874pt
  screen — so no pixel of this site can reach it. What it does instead is read
  the `background-color` of a fixed or sticky element at the top of the viewport
  and fill the bar with that. `.nav-shell` is the candidate and it is
  transparent, so there is nothing to read and the bar is glass over whatever
  page content is beneath it: on a dark article that reads as a slab, which is
  the seam above the frosted header.

  Measured on an iPhone 16 Pro with `static/safari-bar-probe.html`, which is the
  only reason any of this is written down — every account of the scan online
  disagrees with the others, and two of them are wrong:
  - an opaque `background-color` on the candidate paints the bar that colour
    flat, and a semi-transparent one plus a `backdrop-filter` paints it as that
    material over the content, which is the look this header wants;
  - **an `opacity: 0` element is not read**, so there is no invisible element
    that can hand Safari the tint — a 4px sliver doing exactly that was tried
    and does nothing;
  - with no candidate at all the bar is the page, blurred.

  **`.nav-edge` is what answers it, and the header's ramp is what makes that
  possible.** The material is a gradient now — the page's own colour, solid at
  the top edge and gone at the bottom — so the colour the bar needs is a colour
  the header already has. `.nav-edge` is 4px of it, `position: fixed` at
  `top: 0`, over the scan's threshold and invisible by construction: the pixels
  directly beneath it are the same colour, at the top of the page and scrolled.
  It is never faded and never animated, because the value that counts is the one
  there at first paint. The shell stays transparent — a colour on it would paint
  the whole row and there would be no ramp to speak of.

  The `theme-color` metas in `app.html` are still what Chrome's toolbar reads.

- **The header's material is a ramp, not a pane**, and both halves of it are
  built to be even. Four masked `backdrop-filter` passes, each band starting
  exactly at the midpoint of the one below it — 18% apart, 36% wide — so the
  number of passes over any point climbs 1, 2, 3, 4 in equal measure; a
  `backdrop-filter` takes in its earlier siblings, so they compound. Bands that
  abut show their seams and bands that overlap unevenly read as a ramp with a
  lump in it. They stop at 90%, because above that the scrim is near-solid and a
  blur under an opaque colour is work nobody sees.

  Over them, one scrim of the page colour: **a smoothstep sampled at eight even
  intervals, which is symmetric** — every pair either side of the middle sums to
  1 — and flat at both ends. The flat ends are the point. A straight alpha ramp
  gives way at the very top edge, where the article shows through the pixels
  that are supposed to match the status bar, and it ends in a visible line at
  the bottom. There is no hairline: the header has no bottom edge to draw.

  It all hangs off `.nav-surface`, which keeps the opacity ramp and the growth,
  and every stop is a percentage — so opening the disclosure lengthens the ramp
  rather than sliding it down, ends pinned and the curve spread over the taller
  header. The one thing a ramp cannot do is hold a row of links at its own
  transparent end, so `.nav-panel` is a flat tint **under** the scrim at
  `0.8 × --nav-surface-menu`. Compositing the gradient over it is the ramp lerped
  into that floor — 1 at the top, floor at the far end, same shape between — which
  is what keeps the fade running the full height of the open header instead of
  collapsing into its top quarter. Putting the tint over the scrim instead just
  flattens it.

- **`--nav-safe-top` reserves the bar's band inside the row, for the cases where
  the page really is laid out under it** — a home-screen web app, and anything
  else where `env(safe-area-inset-top)` is not 0. It is added to the row's
  `padding-block-start`, not to the shell, which would put the band outside
  `.nav-surface`'s box and stop the blur short of the top of the screen. `--nav-h`
  is that reserve plus the row, so `scroll-padding-top` and the hero's timeline
  inset both clear the taller bar; `--nav-name-travel` takes the reserve back
  out, because the band moves the header's bottom edge and the wordmark's resting
  position by the same amount and the handover is the difference. In a Safari tab
  it resolves to 0px and every one of these is the number it always was.
- **The surface is a scroll-driven animation, not a scroll listener.** A
  `scroll(root block)` timeline carries `--nav-surface-scroll` from 0 to 1 over
  `--nav-surface-range`. The listener is installed only where
  `CSS.supports('animation-timeline', 'scroll()')` is false.
- **`opacity: max(--nav-surface-scroll, --nav-surface-menu)`, both registered
  `@property` numbers.** The disclosure drops over page content from scroll
  offset 0, so it has to paint the surface itself. Animating `opacity` directly
  cannot express that: an animation outranks every declaration for the property
  it runs on, so the open menu would have had nothing to say.
- **The wordmark is handed over on the hero's own view progress, one to one.**
  The hero `h2` declares `view-timeline-name: --nav-hero-name` with
  `view-timeline-inset: var(--nav-h) auto`, and `.nav-name-roll` animates across
  that subject's `exit`. `:root` carries the `timeline-scope`. **There is
  deliberately no dial for the range** — a knob there is a knob for taking the
  two names out of step.
- **It lands _on_ the hero name.** The roll starts at `--nav-name-travel` —
  `(--nav-h + 2rem) / 2`, 44px — which is derived, not chosen. **Two animations
  on one timeline**, because the ranges differ: the fade runs `exit` (32px, so
  arrival tracks disappearance 1:1) and the rise runs
  `exit 0px exit var(--nav-name-travel)` (44px over 44px — the page's own rate).
- **`.nav-name` is the hole `.nav-name-roll` moves through**, and has to be a
  second element: the clip must hold still while the type inside it moves.
- **The hole has a soft lower lip, `--nav-name-portal`**, opened _below_ the line
  box with `padding-bottom` and an equal negative `margin-bottom`, so the row
  stays 56px and `--nav-h` does not move. The mask's solid end is pinned to
  `2rem`, the type's own line, so a deeper lip is a longer dissolve rather than a
  bite out of the wordmark.
- **The fade is on the roll, not on the type.** The English and Korean spans
  cross-fade on their own `opacity` on hover, and an animation outranks every
  declaration for the property it runs on.
- The global `prefers-reduced-motion` rule collapses every `animation-duration`
  to 0.001ms, which would strand a progress-timeline animation at one end. Both
  `.nav-shell` and `.nav-name` re-assert `animation-duration: auto` there.

---

## Web Fonts (`scripts/fonts/build-interlude.py`)

Interlude (Inter + Pretendard) is served as three tiers, all one
`'Interlude Variable'` family behind `unicode-range`:

| Tier     | File                                                   | Holds                                                                                                                  | Loaded                                |
| -------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| core     | `static/fonts/interlude/interlude-core.<hash>.woff2`   | ASCII, nbsp © · – — ‘ ’ “ ”, ← → ↩, and the Latin-1 / Ext-A letters that shared upstream's files with that punctuation | preloaded from `app.html`, every page |
| extended | `interlude-extended.<hash>.woff2`                      | … × ° ± ¥ − ⚠ and the rest of Latin-1 that never shared a file with the core                                           | only by a page that draws one of them |
| hangul   | `hangul/NN.<hash>.woff2` (from interlude-ui **1.3**)   | 11 files of the syllables the site's own text uses (header, post chrome, titles, descriptions, bodies, in that order)  | per character; listings prefetch them |
| hangul   | the same directory                                     | every other syllable, in frequency tiers (`scripts/fonts/hangul-frequency.txt`), and the compatibility jamo            | the async subset sheet, per character |
| tail     | `woff2-dynamic-subset/*.woff2` (upstream's, untouched) | CJK, kana, archaic jamo, rarer symbols — anything a comment might contain                                              | the async subset sheet, per character |

The two `@font-face` rules live between the `@generated interlude` markers in
`app.css`, the preload between the markers in `app.html`. **Generated — rerun
the script, do not edit them by hand.** It is run by hand, not by the build:

```sh
python3 -m venv .venv-fonts && .venv-fonts/bin/pip install -r scripts/fonts/requirements.txt
.venv-fonts/bin/python scripts/fonts/build-interlude.py
```

Rerun when `src/lib/fonts/interlude.test.js` fails (the source started using an
Interlude character only the tail has, or a stylesheet asked for `font-stretch`,
`font-feature-settings`, or a numeric variant other than `tabular-nums`), or to
upgrade Interlude.

**Rendering is identical to the shipped 1.2.1 subset, and the script proves it**
with HarfBuzz before writing: every outline and advance at 40 weight × optical
size instances, and 123k character sequences shaped both ways. Things that make
that true, each of which looked like a free saving and was not:

- **A browser shapes each file separately.** Upstream put ASCII, “ ” – —, ’ ‘
  and © in different files, so `T’s` never kerned. In one file HarfBuzz kerns
  it — 2167 pairs changed. `isolate_layout` cuts every pair, contextual and
  ligature rule down to glyphs from the same old file. And letters that _did_
  share an old file with the core's punctuation (`é”`, `’À`, `É–`) must share
  the core, which is why Latin-1 is mostly there: `--small-core` puts it all in
  the extended file for 16KB less per page, and changes those 228 pairs.
- **No `…` in the core.** Without one in the primary font Chrome builds the
  `line-clamp` / `truncate` ellipsis from three periods. A core with `…` changed
  every truncated title.
- **`wdth` is dropped by deleting tuples, not by fontTools' instancer**, which
  rounds IUP-inferred deltas to integers (renderers keep them fractional) and
  moved 36 of 95 ASCII outlines by half a unit. `wght` is not cut at all: 300–900
  is what the CSS reaches, but limiting it re-derives and re-rounds every delta.
- **Every face keeps upstream's descriptors** (`100 900`, `75% 125%`). Font
  matching groups faces by descriptors before `unicode-range`; a core declaring
  `300 900` would be a different face, and tail characters would fall to the
  system font.
- **MVAR stays out** — upstream's subsets never had it, and it moves the
  underline by weight.
- **STAT stays in**, with the names it points to. It reads as font-menu
  metadata, but without it Safari (CoreText, macOS and iOS) draws a variable
  web font at the bottom of its weight axis: every weight on the site rendered
  as 100. HarfBuzz, FreeType and DirectWrite never read it, so no Linux or
  Windows check could see it — it was bisected on macOS WebKit.
- Only 29 of Latin Extended-A's 128 letters were ever covered (upstream took its
  ranges from Pretendard JP); Č Ł Ş Ž render in the system font, today as before.
  `--full-latin-ext-a` changes that.

### Korean

Upstream 1.2.1's subset CSS never declared the Hangul block, so Korean rendered
in the system font beside Inter until this. Hangul now comes from **1.3**, whose
strokes were rebalanced against the Latin: vertical stems run 0.97–1.01 of
Inter's at 400–600 (1.2.1: 0.90–0.94). Same UPM, vertical metrics and advances,
so it sits beside the 1.2.1 Latin without moving a line; measured on every
Korean page, line boxes are unchanged.

- **Upstream's own 1.3 subsets are unusable here**: 56 files of 200 syllables
  in Unicode order, ~94KB each — a post touches nearly all of them. The site's
  syllables are sliced by who draws them, so `/blog` needs 22KB of Hangul and a
  post ~240KB, shared by every Korean page.
- **`FontPrefetch.svelte`** on the three listings prefetches those files and
  the extended file at idle, after `load`. With production cache headers a post
  opened from the home page makes no Hangul request. Skipped on Save-Data, 2G,
  and for a `preferred-lang=en` visitor.
- **`:lang(ko)` sets `word-break: keep-all`.** Korean is spaced by word; CSS's
  default broke 685 lines mid-word across the posts. Scoped by `lang` because
  Chinese and Japanese have no spaces. Listing records carry `lang` (from
  `listingItem` in `server/content.js`) so Korean titles on English pages get it too.
- **Hangul carries the Latin's `prep` and `gasp`** (`match_rasterizer`).
  Windows rasterizes each file through DirectWrite, which picks grid-fitting
  and smoothing from that file's own tables; 1.3 dropped the 7-byte `prep` the
  1.2.1 Latin has, so a Korean word and the English beside it ran different
  programs. Outlines are untouched, and Linux and macOS renders are
  byte-identical with and without it.
- **Not reachable with split files:** in one Interlude file, `( ) [ ] : - @ ~`
  beside Hangul take CJK-height `.case` forms. A browser shapes each file
  separately, so here they stay at Latin height — under 1px at body sizes,
  about 2px at 40px.

Known difference: CJK punctuation and fullwidth forms moved from the old base
file to the tail, so ASCII `( ) [ ] - : @ ~ …` next to `「」〈〉：` no longer
takes Interlude's CJK-height case form. Keeping it would put ~120 CJK glyphs in
the preloaded core.

---

## The Authoring Extension (`tools/vscode-extension/`)

A VS Code / Cursor extension for the content tree. Plain CommonJS with JSDoc,
no build step and no runtime dependencies — the extension host loads
`src/extension.js` as it is. <kbd>F5</kbd> runs it from source; `npm run
test:extension` runs its `node:test` suite, and `npm test` includes it.

**CommonJS is not a style choice.** The extension host loads extensions through
`require`, and `vscode` only ever exists as a host-injected module. That is why
`eslint.config.js` carries an override for this tree — including turning off
`svelte/no-inner-declarations`, whose wrapper around the core rule reads scope
state that only exists for `sourceType: module` and throws otherwise.

Everything that can be tested without an editor is in `src/lib/` and is:
`markdown-scan` (one pass producing frontmatter, images, `src=` attributes,
gallery fences, brace expressions and the instance `<script>`, with everything
inside code masked), `frontmatter`, `content-file`, `naming` and `insert`.
`src/providers/` and `src/commands/` are the thin editor-facing half.

**Where the site already has the rule, the extension loads it** rather than
copying it: `workspace.siteModule` imports a dependency-free module of the
site from the workspace (image sizes from `src/lib/markdown/image-size.js`,
article URLs from `src/lib/content/article-paths.js`). Opened on markdown
outside this repository the import fails, and every caller treats that as no
answer.

- **A drop is filed by the post, not by the file.** Editing
  `blog/{en,ko}/us-camp.md` sends media to `static/images/uploads/us-camp/`;
  a project sends it to `static/images/projects/<slug>/`. Both languages of an
  entry share one folder — they are the same post.
- **Several images at once land on consecutive lines with no blank line
  between them**, which is exactly what `remark-gallery` reads as a group. The
  drop produces a `<Gallery />` for the same reason a hand-typed run does.
- **A video lands as `![label](/videos/x.mp4)` in a paragraph of its own**, not
  as a hand-written `<LazyVideo>`, so `remarkLazyVideo` measures it and brings in
  the import.
- **The copy is a `WorkspaceEdit.createFile`, not an `fs` write**, so the link
  and the file are one undo.
- **Only formats a browser cannot render are transcoded** (HEIC, TIFF).
  `npm run optimize-images` already re-encodes from git HEAD at build time, and
  a drop-time re-encode would hand it worse input. Conversion shells out to the
  workspace's `sharp` in a child process — the extension host is Electron, and
  sharp's prebuilt binaries are built against Node's ABI — then falls back to
  `sips`, then to copying with a warning.
- **The built-in markdown drop/paste handler has to be turned off**, which
  `.vscode/settings.json` does: it copies media next to the document. The same
  file names this extension's edit kind in `editor.pasteAs.preferences` so a
  drop never opens the "paste as" picker.
- The diagnostics cover the failure modes this tree actually has: a missing
  media file, empty alt text, a `:::gallery` that never closes (which silently
  transforms nothing), a component used without its import, frontmatter gaps, a
  `slug` disagreeing with the filename, and **a smart quote inside `{}` or the
  `<script>`** — the hard rule at the top of this file, which is invisible in a
  proportional font and a `js_parse_error` at build time.

---

## Environment Variables

| Variable            | Used in                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `PUBLIC_CONVEX_URL` | Convex client — browser (root layout) and server-side HTTP client    |
| `ADMIN_SECRET`      | Admin auth (header + cookie + Convex bypass) — must match Convex env |
| `IP_HASH_SECRET`    | HMAC for `hashIp`. Must be in `turbo.json` `build.env`               |
| `CONVEX_DEPLOY_KEY` | Build-time only (Vercel). Sets `PUBLIC_CONVEX_URL` automatically     |
| `HEALTH_API_KEY`    | Apple Health ingest — the Shortcut's bearer token. Convex-side only  |

`LAST_FM_PUBLIC_API_KEY` is Convex-only — the feed cron reads it inside the
deployment, so it never reaches SvelteKit or Vercel.

**SvelteKit only sees what `src/env.js` declares.** Each entry is `public` or
not (`$app/env/public` vs `$app/env/private`) and `static` or not (inlined at
build time vs read at startup). All five are `static`. `PUBLIC_GIT_COMMIT` and
`PUBLIC_GIT_COMMIT_DATE` are written onto `process.env` by `vite.config.ts`, so
they exist at build time and nowhere else — read at startup they would be empty
on every SSR page.

---

## Convex

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

`npm run lint` enforces Convex's own best-practice rules on `convex/*.js`
(`@convex-dev/eslint-plugin`: explicit table names on `ctx.db` calls, argument
validators, no `.filter()` on a db query, no prefix-duplicate indexes, no
top-of-the-hour crons). `eslint.config.js` says which of its rules are off and
why.

<!-- convex-ai-end -->
