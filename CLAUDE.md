# Project Guidelines

## Hard rules

- **Straight quotes only** (`'`, `"`). Svelte's parser throws `js_parse_error` on
  smart quotes inside `{}` expressions.
- **No TypeScript.** Everything is plain JavaScript with JSDoc. `src/app.d.ts`
  and `src/lib/types.d.ts` are the only `.ts` files — both are type-only.
  Security-relevant modules (`src/lib/server/*`) carry `// @ts-check`, which
  `npm run check` enforces.
- **`.js` modules are kebab-case; `.svelte` components are PascalCase.**
- After `npm install`, delete `pnpm-lock.yaml` if it appears — it goes stale and
  causes `ERR_PNPM_OUTDATED_LOCKFILE`.

---

## Project Overview

A SvelteKit personal site: a blog, a projects section, `/now`, a `/health` page
fed by Apple Health, and a comment system with voting, admin replies, IP bans
and rate limiting.

**Stack:** SvelteKit · Convex (database + functions + realtime) · bcryptjs ·
Zod. Rate limiting lives inside Convex via `@convex-dev/rate-limiter`, not
Upstash. There is no SQL database — all persistence is Convex tables.

---

## Directory Structure

```
src/
  app.css                  # Tokens, base layer, feature keyframes
  app.d.ts                 # Ambient declarations (__DIALS__, App namespace)
  app.html                 # Owns the dark/light class on <html> (pre-hydration)
  hooks.server.js          # Resolves the %lang% placeholder in app.html
  content/                 # Markdown, outside the router
    blog/{en,ko}/*.md
    projects/{en,ko}/*.md
  lib/
    api-client.js          # apiFetch — the only way components call /api
    format.js              # formatDate / formatDateLong / formatDateTime / sliceText
    reduced-motion.svelte.js  # One shared prefers-reduced-motion subscription
    theme.svelte.js        # Observes the class app.html sets; never sets it
    types.d.ts             # Post / Project / Tags
    actions/               # auto-height, in-view-once, marquee
    article/               # ArticleDials + settings
    comments/              # CommentsSection, CommentNode, AdminCommentNode, build-tree
    content/bilingual.js   # en/ko module resolution for the [slug] routes
    dev/                   # DialsHost, DialsMount
    error/                 # ErrorPage, LifeField, life, glyph, settings
    health/                # MetricChart, MetricSection, RangePicker, ScoreDial, metrics
    home/                  # HomeDials + settings
    lightbox/              # Lightbox, Gallery, store, geometry, spring, velocity,
                           # flight, modal, image-cache
    likes/LikeButton.svelte
    markdown/              # remark-gallery, remark-image-size, image-size,
                           # remark-lazy-video, splice-import, remark-reading-time,
                           # reading-time, rehype-strip-code-tabindex,
                           # pretty-code-highlighter
    nav/                   # NavBar, NavDials, settings, hero
    og/                    # satori OG image templates + render
    pasito/                # Svelte port of joshpuckett/pasito
    server/                # admin, api, content, content-modules, content-page,
                           # convex, ip, valid-urls, validation
    techstack/             # TechStack + data
    ui/                    # LanguageSwitcher, LazyVideo, SeriesList, StableLangStack
  routes/
    +page.server.js        # Home (prerendered) — reads the lists directly
    blog/, projects/       # Listing (prerendered) + [slug] (SSR)
    now/, health/, admin/
    api/                   # comments, likes, now, og, posts, projects, admin/*
    rss.xml/+server.js
convex/
  schema.js comments.js likes.js bans.js now.js feeds.js admin.js
  rateLimits.js health.js healthPublic.js http.js crons.js backfill.js
  lib/                     # Shared helpers; the pure ones are unit-tested
```

Tests are co-located (`*.test.js`, `*.svelte.test.js`). `vitest.config.ts`
defines three projects: `unit` (node), `convex` (edge-runtime), `component`
(jsdom).

---

## Convex Schema (`convex/schema.js`)

| Table              | Key fields                                                                                                             | Indexes                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `comments`         | url, username, passwordHash, text, ipHash, parentId (id\|null), depth, reply, updatedAt, deletedAt, upvotes, downvotes | `by_url_deleted`, `by_parent`              |
| `commentVotes`     | commentId, ipHash, voteType (`'up'`\|`'down'`)                                                                         | `by_comment_ip`, `by_ip`                   |
| `likes`            | url, ipHash                                                                                                            | `by_url_ip`                                |
| `commentUrlCounts` | url, count                                                                                                             | `by_url`                                   |
| `likeCounts`       | url, count                                                                                                             | `by_url`                                   |
| `migrationMeta`    | key, complete                                                                                                          | `by_key`                                   |
| `bannedIps`        | ipHash, reason                                                                                                         | `by_ip`                                    |
| `nowPage`          | content, updatedAt                                                                                                     | —                                          |
| `nowPlaying`       | tracks[], updatedAt — one row                                                                                          | —                                          |
| `photos`           | photos[], updatedAt — one row                                                                                          | —                                          |
| `healthDaily`      | date (`YYYY-MM-DD`), metric, value, unit, source?, updatedAt                                                           | `by_metric_date`, `by_date`                |
| `healthBuckets`    | metric, hour (epoch ms), count, sum, min, max, unit                                                                    | `by_metric_hour`, `by_hour`                |
| `healthSamples`    | metric, value, time, unit, source? (raw, pruned at 30d)                                                                | `by_metric_time`, `by_time`                |
| `healthWorkouts`   | externalId, type, start, end, duration, distance?, activeEnergy?, avgHeartRate?, maxHeartRate?, elevation?, source?    | `by_start`, `by_type_start`, `by_external` |

**Prefix rule:** an index whose fields are a prefix of another is redundant —
bind only the leading fields of the longer one. `by_url` on `comments` is gone
for this reason: hard delete only sets `deletedAt`, so tombstones stay forever,
and every public read binds `by_url_deleted` with `.eq('deletedAt', null)` to
skip them at the index rather than filtering in JS.

`createdAt` is Convex's built-in `_creationTime`.

**`ipHash` is served by `src/lib/server/content-page.js`** on the SSR `[slug]`
routes. Do NOT move it into a root layout load: the root pages are prerendered,
which would bake the build machine's hash into the static payload.

Schema changes: edit `convex/schema.js` and run `npx convex dev`. There are no
migration files.

---

## Authentication & Admin

- **`ADMIN_SECRET`** in env. `verifyAdminSecret(request)` accepts either the
  `x-admin-secret` header or the `admin_token` cookie.
- **Page auth:** `routes/admin/+page.server.js` checks the password with
  `secretsMatch` (HMAC, constant-time) and issues a signed
  `expiresAt.nonce.signature` token as an httpOnly, sameSite=strict cookie for
  24h. The secret never reaches the page — `load` returns only
  `{ authenticated }`.
- All `/api/admin/*` routes require the header and return 401 otherwise.
- Convex mutations take an optional `adminSecret`; when valid it bypasses rate
  limits and per-IP checks.

---

## Rate Limiting

Inside Convex (`convex/rateLimits.js`), keyed on `ipHash`, so limits survive
SvelteKit cold starts and apply to direct Convex mutations too. Admin requests
with a valid `adminSecret` bypass everything. A rejected limiter throws;
`convexErrorToResponse` in `src/lib/server/api.js` maps that to a 429 with
`Retry-After`.

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
retains the _previous page's_ result across a client-side navigation. Both track
`freshPath` and gate rendering and every write on
`freshPath === page.url.pathname`. Any new `keepPreviousData` subscription keyed
on the pathname needs the same guard, or visitors can act on the page they left.

---

## Comment Deletion Semantics

- **Soft delete** — sets `text` and `username` to `[deleted]`. The row stays, so
  thread nesting is preserved.

  The public `DELETE /api/comments/[id]` **always** soft-deletes and never
  inspects admin auth. The site owner browses their own posts holding an
  `admin_token` cookie, so branching on admin there turned an ordinary
  visitor-side delete into a hard delete of the whole subtree.

- **Hard delete** — sets `deletedAt`, excluded from every public query by the
  `by_url_deleted` index. Children keep their `parentId` and surface as "stray"
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
  by one meant 200 reads and 200 patches of a single row in one transaction. The
  batch helpers (`applyUrlCountDeltas`, `applyLikeCountDeltas`) take a
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

---

## Content Lists

`src/lib/server/content-modules.js` holds the eager metadata globs, and **both
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
| `likeSchema`          | url                                                               |
| `replySchema`         | reply (max 1000)                                                  |
| `banSchema`           | commentId (Convex id), reason? (max 500)                          |

---

## Lightbox and Gallery (`src/lib/lightbox/`)

`Lightbox.svelte` orchestrates; the logic lives in modules beside it —
`geometry.js` (sizing, paging and settle maths, unit-tested without a DOM),
`spring.js`, `velocity.js`, `flight.js`, `modal.js`, `store.svelte.js`.

**The lightbox opens groups, not images.** `lightboxAction` looks for a
`[data-lightbox-group]` ancestor: inside one, the whole group opens at the
clicked index; outside one it is a group of one. The grouping is declared in
markup rather than guessed from sibling images, so an article of unrelated
screenshots doesn't become a slideshow.

Per-image opt-outs on the `<img>`: `data-no-lightbox` excludes it,
`data-lightbox-src` points at a larger file, `data-lightbox-caption` overrides
the alt text. The source comes from the `src` attribute, not `currentSrc` —
on a `srcset` image that is whatever the browser picked for the _thumbnail_.

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

- **The header's material is a ramp, not a pane.** Four masked
  `backdrop-filter` passes whose bands each start a quarter higher than the
  last, so the blur compounds upward — a `backdrop-filter` takes in its earlier
  siblings — under one eased scrim of the page colour. There is no hairline: the
  header has no bottom edge to draw. Everything still hangs off
  `.nav-surface`, which keeps the opacity ramp and the growth, so the gradient
  is always the height the header currently is. Two things the ramp cannot do
  and are handled beside it: the open disclosure brings its own flat tint
  (`.nav-panel`, on `--nav-surface-menu`), because a row of links cannot sit on
  the transparent end of a gradient; and the deepest blur band stops at 87%,
  because above that the scrim is solid and a blur under an opaque colour is
  work nobody sees.

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
inside code masked), `frontmatter`, `content-file`, `naming`, `insert` and
`image-size`. `src/providers/` and `src/commands/` are the thin editor-facing
half.

- **A drop is filed by the post, not by the file.** Editing
  `blog/{en,ko}/us-camp.md` sends media to `static/images/uploads/us-camp/`;
  a project sends it to `static/images/projects/<slug>/`. Both languages of an
  entry share one folder — they are the same post.
- **Several images at once land on consecutive lines with no blank line
  between them**, which is exactly what `remark-gallery` reads as a group. The
  drop produces a `<Gallery />` for the same reason a hand-typed run does.
- **The copy is a `WorkspaceEdit.createFile`, not an `fs` write**, so the link
  and the file are one undo.
- **Only formats a browser cannot render are transcoded** (HEIC, TIFF).
  `npm run optimize-images` already re-encodes from git HEAD at build time, and
  a drop-time re-encode would hand it worse input. Conversion shells out to the
  workspace's `sharp` in a child process — the extension host is Electron, and
  sharp's prebuilt binaries are built against Node's ABI — then falls back to
  `sips`, then to copying with a warning.
- **`image-size.js` reads dimensions out of the file header** rather than
  pulling in an image library for a hover and a width warning.
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

| Variable            | Used in                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_CONVEX_URL` | Convex client — browser (root layout) and server-side HTTP client                                              |
| `ADMIN_SECRET`      | Admin auth (header + cookie + Convex bypass) — must match Convex env                                           |
| `IP_HASH_SECRET`    | HMAC for `hashIp`. Must be in `turbo.json` `build.env`                                                         |
| `CONVEX_DEPLOY_KEY` | Build-time only (Vercel). Sets `PUBLIC_CONVEX_URL` automatically                                               |
| `HEALTH_API_KEY`    | Apple Health ingest — the Shortcut's bearer token. Convex-side only                                            |
| `CONVEX_SITE_URL`   | Optional override. Convex HTTP actions live on the `.site` twin of `PUBLIC_CONVEX_URL`, derived automatically. |

`LAST_FM_PUBLIC_API_KEY` is Convex-only — the feed cron reads it inside the
deployment, so it never reaches SvelteKit or Vercel.

---

## Convex

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md`
first** for important guidelines on how to correctly use Convex APIs and
patterns. The file contains rules that override what you may have learned about
Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
