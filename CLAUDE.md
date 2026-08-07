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
      content-modules.js   # Eager metadata-only globs for the content md
      content.js           # resolvePublished + publishedPosts/publishedProjects
      content-page.js      # Shared server load for blog/projects [slug] (prefLang + ipHash)
      valid-urls.js        # isValidPageUrl — guards comment/like writes to known pages
      validation.ts        # Zod schemas for all inputs
    types.ts               # Shared frontend types
    utils.ts               # Misc utilities
    lightbox.js            # lightboxStore + lightboxAction — opens images as a group
    Lightbox.svelte        # The lightbox itself (zoom, pinch, swipe, group paging)
    Gallery.svelte         # Image strip with a pasito stepper, one lightbox group
    remarkGallery.js       # Markdown image runs -> <Gallery/>, injects the import
    pasito/                # Svelte port of joshpuckett/pasito — see "Steppers"
      core.js              # computeStepWindow / StepAnimator / AutoPlayController
      Stepper.svelte       # The component (markup + the upstream stylesheet)
      autoplay.svelte.js   # createAutoPlay — upstream's useAutoPlay as a rune
    comments/
      CommentsSection.svelte   # Public comment section (Convex useQuery, forms)
      CommentNode.svelte       # Individual user-facing comment + reply tree
      AdminCommentNode.svelte  # Admin dashboard comment node (admin only)
  routes/
    +page.server.ts        # Home (prerendered) — reads the lists directly
    blog/
      +page.server.ts      # Blog listing (prerendered)
      [slug]/+page.ts      # Blog post (SSR, loads md via import.meta.glob)
    projects/
      +page.server.ts      # Projects listing (prerendered)
      [slug]/+page.ts      # Project detail (SSR)
    now/+page.svelte       # /now page, Convex-backed, markdown via marked
    health/
      +page.server.js      # SSR load — streams api.healthPublic.page (no key, not awaited)
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
  feeds.js                 # Home-page feeds — public reads + cron refreshes (Last.fm, photos)
  admin.js                 # admin-only helpers (URL listing, etc.)
  rateLimits.js            # Convex rate-limiter component config
  health.js                # Apple Health — ingest mutation + internal reads (all internal)
  healthPublic.js          # The one public health query — see "Apple Health" below
  http.js                  # HTTP actions: /health/* (Bearer HEALTH_API_KEY)
  crons.js                 # Daily prune of raw health samples + 5-min home-page feed refreshes
  lib/                     # Shared Convex helpers
```

---

## Convex Schema (`convex/schema.js`)

| Table              | Key fields                                                                                                             | Indexes                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `comments`         | url, username, passwordHash, text, ipHash, parentId (id\|null), depth, reply, updatedAt, deletedAt, upvotes, downvotes | `by_url_deleted`, `by_parent`              |
| `commentVotes`     | commentId, ipHash, voteType (`'up'`\|`'down'`)                                                                         | `by_comment_ip`, `by_ip`                   |
| `likes`            | url, ipHash                                                                                                            | `by_url_ip`                                |
| `commentUrlCounts` | url, count (denormalized active-comment counter)                                                                       | `by_url`                                   |
| `likeCounts`       | url, count (denormalized like counter)                                                                                 | `by_url`                                   |
| `migrationMeta`    | key, complete (one-time backfill completion flags)                                                                     | `by_key`                                   |
| `bannedIps`        | ipHash, reason                                                                                                         | `by_ip`                                    |
| `nowPage`          | content, updatedAt                                                                                                     | —                                          |
| `nowPlaying`       | tracks[] (name, artist, url, image, nowPlaying, playedAt\|null), updatedAt — one row                                   | —                                          |
| `photos`           | photos[] (id, title, url, image, takenAt), updatedAt — one row                                                         | —                                          |
| `healthDaily`      | date (`YYYY-MM-DD`), metric, value, unit, source?, updatedAt                                                           | `by_metric_date`, `by_date`                |
| `healthBuckets`    | metric, hour (epoch ms), count, sum, min, max, unit                                                                    | `by_metric_hour`, `by_hour`                |
| `healthSamples`    | metric, value, time, unit, source? (raw, pruned at 30d)                                                                | `by_metric_time`, `by_time`                |
| `healthWorkouts`   | externalId, type, start, end, duration, distance?, activeEnergy?, avgHeartRate?, maxHeartRate?, elevation?, source?    | `by_start`, `by_type_start`, `by_external` |

Prefix rule: an index whose fields are a prefix of another (e.g. `by_comment`
vs `by_comment_ip`) is redundant — bind only the leading fields of the longer
index instead. `by_url` on `comments` is gone for this reason: hard delete only
sets `deletedAt`, so tombstones stay in the table forever, and every public read
binds `by_url_deleted` with `.eq('deletedAt', null)` to skip them at the index
rather than collecting the URL and filtering in JS.

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
- **Page auth:** `src/routes/admin/+page.server.ts` checks the password with `secretsMatch` (HMAC, constant-time) and issues a signed `expiresAt.nonce.signature` session token, set as an httpOnly, sameSite=strict cookie for 24 h. The secret itself never reaches the page — `load` returns only `{ authenticated }`, and `verifyAdminSecret` accepts either the `x-admin-secret` header or that cookie.
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

Public surfaces (CommentsSection, LikeButton, /now, the home page's Now Listening and Photos sections) subscribe to Convex via `convex-svelte`'s `useQuery`. Updates push over WebSocket, so no manual polling. `setupConvex(PUBLIC_CONVEX_URL)` runs once in the root layout.

The subscriptions never gate a page render: the home page is prerendered, its
loads fetch nothing from Convex, and each section renders its own skeleton off
`query.isLoading` while the socket resolves.

CommentsSection and LikeButton pass `keepPreviousData: true` so their content
doesn't flash back to a skeleton when the `ipHash` re-subscription swaps the
query args. Because that also retains the _previous page's_ result across a
client-side navigation, both components track `freshPath` — the pathname the
latest non-stale result belongs to — and gate rendering and every write on
`freshPath === $page.url.pathname`. Any new `keepPreviousData` subscription
keyed on the pathname needs the same guard, or visitors can act on the page
they just left.

---

## Home-Page Feeds (`convex/feeds.js`)

Now Listening (Last.fm) and Photos (`photos.injoon5.com/feed.json`) are pulled by
a Convex cron every 5 minutes, replacing a GitHub Action that committed JSON to
a data repo and a browser fetch of those raw files.

- `internal.feeds.refreshNowPlaying` / `refreshPhotos` — one action per feed, so
  Last.fm being down doesn't hold back photos.
- Each action normalizes the response down to what the page renders
  (`convex/lib/feeds.js`) and hands it to a one-row upsert. The raw payloads are
  ~20x larger and carry `#text`/`@attr` keys the schema shouldn't.
- **A failed or empty upstream response throws instead of writing.** The stored
  row survives, so the page keeps showing the last good feed rather than emptying
  out. `convex/feeds.test.js` asserts this — keep those cases.
- **An unchanged feed is not written either.** Convex invalidates subscriptions
  on the document, so re-patching an identical row pushed a websocket update to
  every open home page every five minutes to say nothing had happened — 288 a
  day per feed. `sameFeedRows` compares the normalized list against the stored
  one and the mutation returns `{ changed: false }` without touching it. The page
  reads `lastScrobbledAt` off the tracks and never renders `updatedAt`, which is
  what makes holding the row still invisible to it.
- `api.feeds.nowPlaying` / `api.feeds.photos` are public queries. They can be:
  both feeds are already public at the source, and the home page renders exactly
  what they return.
- Needs `LAST_FM_PUBLIC_API_KEY` in the Convex env (`npx convex env set`).

---

## Comment Deletion Semantics

- **Soft delete** — sets `text = '[deleted]'` and `username = '[deleted]'`. Row stays in the table; thread nesting is preserved. Shown to public as `[deleted]`.
  The public `DELETE /api/comments/[id]` route always soft-deletes and never
  inspects admin auth. The site owner browses their own posts holding an
  `admin_token` cookie, so branching on admin there turned an ordinary
  visitor-side delete into a hard delete of the whole subtree. Hard delete is
  reachable only through `DELETE /api/admin/comments/[id]`.

- **Hard delete** — sets `deletedAt` to a timestamp. Excluded from every public query by the `by_url_deleted` index bound to `deletedAt: null`. Children of a hard-deleted comment keep their `parentId` referencing the now-hidden row, which is surfaced as "stray" in the admin tree.

  A hard delete walks the subtree in batches of 200. **The continuation resumes
  from the nodes the previous batch did not reach, not from the root** — it is
  handed that frontier as a scheduler argument. Restarting at the root re-issued
  a `by_parent` query for every node an earlier batch had already retired, so the
  reads to delete a thread grew with the square of its size.

---

## Denormalized Counts

Four counters are kept beside the data they count, and all of them are stepped
by a delta rather than recomputed:

- `comments.upvotes` / `downvotes` — moved by what the vote toggle actually
  changed. **Do not "fix" this back to a recount.** Convex mutations are
  serializable transactions, so a read-modify-write cannot lose an update; the
  recount was not buying safety, and it read every vote row on the comment per
  vote (500 votes → 500 reads to record one). It also widened the read set to
  that whole range, which makes OCC conflicts _more_ likely, not less. Rows
  written before the backfill carry no counts and still fall back to one count.
- `commentUrlCounts` / `likeCounts` — one `adjustCount(ctx, table, url, delta)`
  per distinct URL. Every comment in a subtree shares a URL, so stepping by one
  meant 200 reads and 200 patches of a single row inside one transaction. The
  batch helpers (`applyUrlCountDeltas`, `applyLikeCountDeltas`) take a
  `Map<url, delta>`.

`convex/votes.test.js` checks every path through the toggle — including the
stray-row dedupe and a drifted count — against a full recount of the votes
table. Keep those: they are the only thing standing between a delta bug and a
count that is silently wrong forever.

A **sharded counter** (`@convex-dev/sharded-counter`) is the wrong tool here and
was considered. It solves write contention, which this site does not have, and
pays for it on reads: `count()` reads all 16 shards, so `likes.get` — which runs
on every page view and every subscription — would go from one read to sixteen.
It also has no way to enumerate keys, which `admin.listUrls` needs.

---

## Stray Comments (Admin Page)

When a parent comment is hard-deleted, its children still carry the original `parentId` but the parent is filtered out of public queries. The admin page's `buildTree()` function surfaces those children as root-level nodes with `stray: true` and renders them with an amber "orphaned reply — parent deleted" badge.

---

## Steppers, Galleries and the Lightbox

`src/lib/pasito/` is a Svelte 5 port of
[joshpuckett/pasito](https://github.com/joshpuckett/pasito), the fluid stepper.
The props and the `--pill-*` theming variables are upstream's, so its README
still describes this. Two deliberate divergences:

- **`core.js` is the upstream `core/` directory, in plain JS.** Upstream splits
  React and Vue wrappers over a shared core; keeping that split is what lets the
  windowing and the enter/exit reconciliation be tested without a DOM.
  `computeStepWindow`'s `DEFAULT_METRICS` have to stay in step with the
  `--pill-*` defaults in `Stepper.svelte` — it turns a step index into a pixel
  offset, so changing the dot size in CSS alone slides the track wrong.
- **`Step.tsx` is inlined into `Stepper.svelte`.** Half of pasito's stylesheet is
  `.pasito-vertical .pasito-step`-shaped descendant rules, and each one would
  need a `:global()` hole punched through a component boundary.

An entering step has to render collapsed and _paint_ before it is promoted, or
there is nothing to transition from — hence the reconcile in `$effect.pre` and
the two `requestAnimationFrame`s. One frame is not enough; it lands both states
in the same paint.

**The lightbox opens groups, not images.** `lightboxAction` looks for a
`[data-lightbox-group]` ancestor on the click path: inside one, the whole group
opens at the clicked index and the lightbox grows a stepper, arrow keys, arrow
buttons and sideways swipe; outside one, it is a group of one and behaves
exactly as it did before. The grouping is declared in markup rather than guessed
from sibling images, so an article of unrelated screenshots doesn't become one
long slideshow. A bare `{ src, alt, ... }` set on the store is still accepted —
`normalizeLightboxValue` widens it.

Per-image opt-outs live on the `<img>`: `data-no-lightbox` keeps one out
entirely, `data-lightbox-src` points at a larger file than the one on the page,
and `data-lightbox-caption` overrides the alt text. The source is taken from the
`src` attribute rather than `currentSrc`, which on a `srcset` image is whatever
the browser picked for the _thumbnail_ box.

### It opens as the same photo, not a new one

The image does not fade up in the middle of the screen. It **flies from the box
it holds in the article to the box it holds full-screen**, and back to wherever
that image sits when you close — which, after paging, is a different image than
the one you opened. `lightboxAction` puts the `<img>` element itself on each
item so the lightbox has something to measure and return to.

- **The copy on the page is hidden (`visibility`, not `display`) for as long as
  the lightbox is showing it**, and un-hidden in the portal's `destroy` — the
  same frame the flying copy is removed, so the two are never both on screen and
  never both absent. `display: none` would reflow the article underneath and
  destroy the box the flight is aimed at.
- **The flight is a WAAPI animation, not a class or an inline transform.** It
  runs off the main thread, and — unlike `style.transform` — Svelte rewriting the
  `style` attribute mid-flight (which it does whenever the fit is recomputed)
  cannot wipe it out. No `fill: forwards` on the way in, so pan and zoom get
  control back the moment it lands.
- **One uniform scale**, never a separate scaleX/scaleY: both ends are
  `object-fit: contain` around the same file, so their aspect ratios agree and a
  second axis could only distort the photo in flight.
- **Closing realigns the scroller first.** `alignOrigin` centres the target
  inside its own horizontal scroller, so closing on the fourth image of a strip
  lands on the fourth image instead of flying off the side of it — and the strip
  is left where the lightbox left off. It never touches page scroll; that is
  locked.
- It falls back to a plain scale-and-fade whenever it cannot fly: no origin
  element (a caller that set the store by hand), no natural size yet, a zoomed
  image, an origin still off-screen after aligning, reduced motion, or no layout
  at all (which is what keeps jsdom happy). **Two flags, not one**: `flew`
  suppresses the stage's own entrance for the whole open, `flying-home`
  suppresses its exit only while a flight home is running — one flag meant a
  close that could not fly lost its exit animation entirely.
- **Closing mid-anything is a supported state.** Closing during the opening
  flight picks up the photo's current computed transform rather than snapping it
  to full size first; closing while the track is still settling from a page
  drops the track's transition so the measurement is taken against the resting
  position it was heading for, not a moving one.
- **Swipe-to-dismiss returns the photo too.** It follows the finger down, and
  on release travels on to the place it holds in the article — which is often
  back _up_ past where the drag started. The drag lives on `.lb-strip`, not on
  the photo, so the strip is unwound and the distance it had travelled is handed
  to the photo's own first keyframe: one animation carries the whole journey
  rather than two transforms fighting over the same pixels. With no origin to
  return to it falls back to the old throw, and only then does the page-side
  copy come back early, so the strip never has a hole in it.
- **A close arms an unmount timer past the animation.** Opening clears it:
  reopening inside that window used to be shut straight back down by the timer
  from the close before it.
- **The flights are springs, not curves that resemble them.** `springEasing`
  writes a damped oscillator out as a `linear()` easing, so WAAPI still runs it
  on the compositor. Parameterised by bounce, the damping ratio read the other
  way up — 0.25 opening, which passes its mark by about 3%, and 0 coming home,
  because past the mark would be past the slot the photo belongs in. The strong
  ease-out this replaced was 80% of the way there a quarter of the way through
  and then crawled, which is what made opening feel stiff. There is a
  `cubic-bezier` fallback for browsers without `linear()`.
- **The caption slot is held open across the group**, at exactly the two lines
  it clamps to, whenever any image in the group is captioned. The chrome's
  measured height is what reserves room for the photo, so a caption that wrapped
  where its neighbour did not resized the photo you were looking at, in the
  middle of the slide that was swapping them.
- The gallery hands its markdown title through as `data-lightbox-caption`, so
  opening an image does not swap the caption the strip showed for its alt text.
- **What lands has to be the shape the page is about to show.** A photo back in
  its slot but still carrying a lifted photo's shadow and rounded corners reads
  as sitting on top of the article, so both are shed on the way home. The page's
  own copy is handed back from the flight's `onfinish` rather than from the
  portal's teardown — the two overlap exactly, so the swap is invisible, where
  waiting for Svelte to unmount left the photo above the page for the frames in
  between. The root is `pointer-events: none` for that stretch too.

### Keeping it at 60fps

Measured on the production build at 6x CPU throttle, 390x844 @2x, counting
frames over 20ms during each phase. The drags are the ones that matter: they run
on the main thread, so a long frame there _is_ visible jank. The two flights are
WAAPI transforms on the compositor, where a busy main thread starves the rAF
counter without stalling the animation.

- **`-webkit-backdrop-filter` goes before `backdrop-filter`, always.** Written
  the other way round the minifier collapses the pair to the prefixed
  declaration alone, and Chrome and Firefox — which have never supported the
  `-webkit-` form — render no blur at all. Every blur in the lightbox and the
  gallery had been shipping that way. Check `_app/immutable/assets/*.css` after
  a build if you touch one.
- **The blur is the most expensive thing on screen.** Over a dismiss drag: 0
  frames missed with no blur, 2 at `blur(8px)`, 5 at the `blur(14px)
saturate(1.1)` it started at. At the opacity the scrim actually reaches the
  8px and 14px versions are indistinguishable, so 8px it is.
- **The backdrop is two elements.** Fading a blurred one does not fade the blur,
  it reveals the sharp page underneath — mid-dismiss you could read the article
  through it. The material and the dimming are separate, the same way iOS keeps
  them apart. This costs nothing and buys nothing on frame times; it is a
  looks-right change.
- **One `style:` directive per property, not one `style` string.** A single
  string is re-parsed in full every frame of a drag, transition declaration
  included.
- **Writes before reads in the release handler.** Interleaving them forces a
  layout per read, in the one frame a finger is lifted.
- `will-change: transform` sits on `.lb-img[data-current="true"]` only — the
  other slides ride inside the track's layer and promoting them would cost three
  full-screen textures to animate one.

### The lightbox is a filmstrip, not a slot

Every image in the group is a slide on one flex track that is translated
sideways; the group is not swapped in and out of a single `<img>`. That is what
makes a drag show the next photo arriving instead of the current one sliding
away over nothing. Consequences worth knowing:

- **The track is `position: absolute; inset: 0`, and the slides overflow it.**
  Its own width therefore stays one page, which is what lets `translateX(-i *
100%)` mean "one page per step" rather than a fraction of the whole strip.
- **Only the current slide and its neighbours carry a `src`** — a gallery of
  forty is forty slides and three requests — but that window is `windowIndex`,
  which is `index` **one frame late**. Mounting the next neighbour's `<img>` in
  the same commit that starts the page made that commit long, so the settle
  began late and the whole slide read as a stutter. A frame later the track's
  transform is already on the compositor and no DOM work can stall it. A jump of
  more than one step catches up immediately: there is no in-between to protect,
  and the tests page synchronously.
- **Chrome lives outside the transform.** Caption, dots and buttons are siblings
  of the track, so a swipe moves the photo and nothing else.
- **`will-change` on the current image is gated on `.zoomed`.** Paging moves
  `data-current` from one image to the next, so a hint hanging on that attribute
  alone tore down a compositor layer and built another in the very commit that
  starts the settle. The track is promoted either way, so the slides composite
  through it; the per-image hint is for pinch and pan, the only times an image
  moves inside the track. The flights need none — a WAAPI transform is
  composited on its own.
- The image the tests mean is `.lb-img[data-current="true"]`.

The swipe axis is **locked once**, on the first 8px of movement, and not
re-decided per move: sideways pages, downward dismisses. Re-deciding let a
diagonal flick do both. A release pages on **velocity or distance** — a fast
flick that moved 30px pages, and so does a slow drag past a fifth of the
viewport; distance alone made a real flick feel ignored. Drags past either end
get the iOS rubber band, which asymptotes rather than stopping dead.

### Paging has to feel like the strip in the article

The gallery outside is a native scroll-snap container. The lightbox re-implements
paging by hand, and everything that made it read as janky next to the strip was
somewhere the hand-rolled version diverged from what a scroller does for free:

- **The lock threshold is taken back out of the first frame.** The photo used to
  sit still for 8px and then jump 8px, at the one moment the eye is certain to be
  on it. `slopX`/`slopY` subtract however much of the threshold the axis was
  decided on.
- **A settle is interruptible.** `pickUpTrack` reads the track's live matrix when
  a gesture takes over — the axis lock for a finger, the first event for a
  trackpad — and seeds the drag with it, so grabbing a page still in flight stops
  it under the finger instead of teleporting it to where it was heading. The page
  decision is then made on `dragX - carryX`, the distance the gesture itself
  travelled: counting the carry as movement paged on a finger that never moved.
- **The settle leaves at the speed the gesture ended at.** `springEasing` takes an
  initial velocity (fractions of the remaining distance per unit of its own
  duration) and `armTrackSettle` hands the track a one-off `transition` built from
  how far it still has to go and how fast it was going. A fixed curve leaves at
  the same rate whether the photo was thrown or nudged, which is the whole of why
  paging felt detached from the swipe. Capped at 6, where a critically damped
  spring starts to overshoot — a page sailing past its slot and coming back is a
  bounce the scroller outside does not have. Negative is a release still
  travelling out of a rubber band, and that one does carry on and return.
  Duration scales with `sqrt(distance / page)` between 190 and 340ms. Non-gesture
  paging — an arrow key, a tapped dot — has no velocity to carry and keeps the
  shared curve.
- **Flick velocity is measured over a 60ms window**, not off the last
  `pointermove`. Two events 4ms apart on a 120Hz screen make a single-sample
  velocity mostly noise, which let an obvious flick fail to page and a careful
  nudge shoot away. A finger resting on the photo sends no moves at all, so its
  samples fall out of the window and it has no velocity — which is right.
- **A trackpad swipe moves the track under the fingers.** It used to accumulate
  80px in silence and then jump a whole page. macOS momentum keeps arriving after
  the fingers lift and has decayed to nothing by the time the events stop, so the
  gesture ends on 90ms of quiet and settles on where it came to rest — there is no
  flick left to read off it.

`springEasing`'s two flight callers pass no velocity and are byte-identical to
what they were; the critically damped branch is the same expression with `v0 = 0`.

Zoom is **one number** (`scale` + `panX`/`panY`). It used to be two — a
click-to-zoom flag that swapped the image's width and a separate pinch scale —
and they could disagree. Pan is clamped to the image's own edges, tap and pinch
share `scaleAbout` so both anchor on the point under the finger, and the chrome
except the close button fades out while zoomed: no scrim makes a caption
readable over every photograph, and a zoomed image is being inspected.

**Full-screen is not `inset: 0`.** Two things break it and both are handled in
`Lightbox.svelte`:

- Any ancestor with a transform, a filter or `contain` becomes the containing
  block for a fixed child. The dialog is therefore **portalled to `<body>`**, so
  it has no ancestor left to be trapped by — and that is also the only moment it
  is provably a body child, which is why `inert` is applied from the portal
  action rather than the open effect (`bind:this` and that effect land in the
  same flush and their order is not ours to pick).
- On mobile the bottom of the initial containing block sits under the collapsing
  toolbar. The root is sized `100dvh` with the measured `window.innerHeight` as
  a floor, not left to `inset`.

Opening also **locks body scroll** (with scrollbar-width compensation, so the
page behind doesn't jump) and **inerts every other child of `<body>`**, which is
what makes `aria-modal` true rather than merely claimed. Both are released
before focus is restored — focus cannot land inside an inert tree.

**Neither the gallery nor the lightbox upscales.** The lightbox's _fit_ caps at
1, and plenty of the images in these posts are 200–500px wide. A gallery that
stretched them to the column width would make opening one look like it had
shrunk it. (Deliberate zoom is the exception — a tap goes to at least 2x even on
a small file, because a gesture that visibly does nothing reads as broken.)

The gallery's slides are all **one fixed height** (`--gallery-height`, overridable
by the `height` prop). Sizing each slide to its image would jump the strip as it
snapped between them, and sizing the strip once the images load would shift the
article under the reader. A swipe on the strip ends in a click, so the track
swallows any click whose press started more than 10px away — otherwise every
swipe opened the lightbox on whatever the finger lifted over. Measured in _page_
coordinates, and only when a pointer actually began the click: viewport
coordinates counted a page still scrolling under a stationary finger as a swipe,
and a click no pointer began (synthetic, keyboard, assistive tech) has no press
to be measured against at all. Arrow keys step a
whole slide rather than leaving the browser's fixed nudge to land between two
snap points. The caption sits above the dots, matching the lightbox; it is
placed with `order` because `<figcaption>` is only valid as a figure's first or
last child.

## Galleries in Markdown (`src/lib/remarkGallery.js`)

A paragraph that is nothing but images becomes a `<Gallery />`:

```md
![Snowflake](/one.png)
![Framer](/two.png)
![Vercel](/three.png)
```

Consecutive lines are one paragraph in mdast, so the run is one the author
already grouped by hand. **A blank line between images is the escape hatch** —
that makes them separate paragraphs and they stay stacked. Only top-level
paragraphs convert; a run inside a blockquote or list item is carrying that
block's meaning.

A `:::gallery` fence is the explicit form, and buys back what that escape hatch
costs:

```md
:::gallery
![One](/one.png)

![Two](/two.png 'A caption')
:::
```

Everything between the fences becomes one gallery however the images are spaced
— including a single image, which two loose images would never become. The
markers are found **inside** paragraph text, not as nodes of their own:
`:::gallery` on the line above an image is the same mdast paragraph as that
image, with the line break living inside a text node. `tokenize()` splits a
paragraph at them and rebuilds a paragraph from whatever is left over.

Three rules keep a typo from eating a post:

- **Only images are collected.** Prose or a heading inside the fence is kept and
  re-emitted after the gallery, never dropped.
- **An unclosed fence transforms nothing** — the `:::gallery` line renders as the
  literal text the author typed. Consuming to the end of the file would have
  swallowed every remaining image in the post into one gallery, silently.
- **A fence with no images transforms nothing**, for the same reason.

The plugin runs **before rehype**, so `rehype-figure` never sees those images —
otherwise a gallery would arrive as four `<figure>`s.

The component reaches the compiled markdown through an import in the file's
instance `<script>`, the same way a hand-written `<LazyVideo />` does. The plugin
splices into an author's existing script when there is one and prepends a new one
otherwise — mdsvex does exactly this splice for its own layout import, and
`extract_parts` hoists the result. Deliberately **not** an mdsvex `layout` with
module-context exports: that mechanism rewrites `tagName` on hast _elements_,
and raw HTML in markdown is a `raw` node that never gets one.

---

## Content Lists (`src/lib/server/content-modules.js`)

The blog/project metadata comes from eager globs, and both halves of the options
matter:

```js
import.meta.glob('/src/routes/blog/posts/en/*.md', { eager: true, import: 'metadata' });
```

- `import: 'metadata'` yields the metadata records themselves rather than whole
  module namespace objects. A namespace object gets passed around as a value, and
  Rollup cannot drop exports it can't see through — so the compiled Svelte
  component for every post rode along with anything that imported this.
- **The options object has to be written out at each call.** `import.meta.glob`
  is a compile-time transform, so Vite reads the options literally. Hoisting them
  into a shared `const` makes it fall back to a _lazy_ glob, whose values are
  import functions — and nothing throws, because `metadata.published` is
  `undefined` on a function. Every post reads as unpublished, and the RSS feed,
  the listing APIs and the valid-URL guard all quietly go empty. This has already
  happened once; `npm run build` and check `prerendered/pages/rss.xml` has items.

The listing pages read `publishedPosts()` / `publishedProjects()` from
`content.js` directly in a **server** load. They used to `fetch('/api/posts')`,
which resolved the same records twice, wrote them into the build twice, and cost
a request on every client-side navigation to a listing page. `/api/posts` and
`/api/projects` still exist as public endpoints — they are just no longer how the
site's own pages get the list.

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
  - The one exception is `convex/healthPublic.js`, which backs both the server
    render and the live subscription on `/health`. It serves _only_ what that
    public page already renders: a fixed metric allowlist (`PUBLIC_METRICS`)
    that arguments cannot widen, and only the range picker's own steps. No raw
    samples, no hourly buckets, no workouts, no other metrics.
    The SSR load calls it through `ConvexHttpClient` rather than the key-gated
    HTTP action, so the render and every visitor's subscription land on one
    query cache entry instead of an action plus four separate ones.
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

### The page (`src/lib/health/`)

- **A gap inside the window is a zero, not a hole.** `zeroFilled()` fills every
  missing day up to a metric's newest reading — a day with no exercise recorded
  is a day with no exercise, and drawing it as a break made a rest day look like
  an outage. Everything _after_ the newest reading is cut instead, so a metric
  that hasn't synced today doesn't dive to the floor on its own right-hand edge.
  `valueAt()` is the same rule for the headline number.
- **The score is the one place a zero is _not_ counted.** `dayScore()` skips any
  metric that reads zero for the day, because a Watch left on the charger and a
  day in bed produce the same zero and only one of them deserves a worse ring.
  So a rest day scores on whatever else moved, or reads "No data" when nothing
  did, and `counted`/`of` drives the dial's "N of 4 metrics" caption. Do not
  "fix" this to match the charts — they are answering different questions.
- **All four charts share one x domain**, spanning the whole window even where a
  line stops early. Index 12 has to be the same day and the same pixel on every
  chart, or the shared marker lands in four different places.
- **Scrubbing does not use layerchart's tooltip layer.** That layer re-targets by
  hit test on every pointer move, so on touch a finger dragging toward the edge
  of one chart handed the page's marker to whichever chart it crossed into.
  `MetricChart` captures the pointer on `pointerdown` and maps x to an index
  itself; `tooltipContext={false}` turns the library's version off. Keep it that
  way — this is the mobile bug, not a preference.
- **The y axis is text only.** `<Axis placement="left" tickMarks={false}>` with
  `rule`/`grid` left at their `false` defaults, two round numbers sampled out of
  d3's tick hint, and `.health-axis-label` in `app.css` cancelling layerchart's
  halo (it exists to sit on gridlines there are none of here).
- **The SSR load is not awaited.** `+page.server.js` returns the Convex promise
  and SvelteKit streams it, so the shell flushes in ~60ms instead of waiting on
  four series. `endDate` resolves from the clock in the first chunk, which is
  what lets the client subscribe at hydration rather than after the stream. The
  cost is that chart markup is client-rendered — keep the placeholder in the
  `{#await}` pending branch matching the real grid, or the page shifts when the
  second chunk lands.
- **Chart dimensions live in `chart-settings.svelte.js`.** On preview
  deployments `HealthDials.svelte` binds a DialKit panel to that same object, so
  the sliders move the real charts. Colours are the exception: they are already
  CSS custom properties, so the panel overrides those on `:root` instead, and a
  control still on its default writes nothing — which is what keeps dark mode's
  own palette. Whatever settles gets copied back into `CHART_DEFAULTS` or
  `app.css` by hand; nothing persists.

---

## DialKit (preview only)

`src/lib/dev/DialsMount.svelte` is mounted once from the root layout and loads
`DialsHost.svelte`, which is the single `<DialRoot />` for the site and nothing
else. There is deliberately no site-wide panel: one meant tuning tokens that only
some pages actually show, which is how you get sliders that appear to do nothing.

Every control lives on the page it affects, as a folder that comes and goes with
the route:

| Panel          | Registered by                     | Moves                                                            |
| -------------- | --------------------------------- | ---------------------------------------------------------------- |
| `Home`         | `lib/home/HomeDials.svelte`       | marquee speed, cover size/gap/scrim, photo columns/count/gap     |
| `Article`      | `lib/article/ArticleDials.svelte` | link underline + offset + thickness, body size, leading, measure |
| `Health chart` | `lib/health/HealthDials.svelte`   | chart geometry and colours                                       |
| `Nav`          | `lib/NavDials.svelte`             | header axis, row spacing, disclosure, chevron, surface, motion   |

`Nav` is the one panel present on every route, and it is not the site-wide panel
the rule above exists to prevent: that rule is about controls for tokens the
current page may not show, and the header is on screen everywhere. Its
`disclosure` folder is the exception worth knowing — those controls do nothing
above `sm`, where the row holds all four links and there is no second row to
space.

Each writes into a `$state` settings module (`*-settings.svelte.js`) whose
values reach the DOM as custom properties on the section they affect — so a
Tailwind-classed page stays Tailwind-classed, and only the one value worth
moving comes from a variable. **Every rule that reads one keeps the class's
original value as its fallback**, so a page that sets nothing renders exactly as
it did before. That is what makes this safe to leave in the shipped CSS.

`marqueeConstantSpeed` reads `--marquee-speed` and listens for a
`marquee:retune` event, because a speed change moves no boxes and its
`ResizeObserver` never fires. Nothing in production dispatches it.

`__DIALS__` is a literal baked in by `vite.config.ts`: `VERCEL_ENV !==
'production'`, falling back to `NODE_ENV` off Vercel. Because it is a literal
and not an env read, Rollup folds `if (__DIALS__)` to `if (false)` in a
production build, the dynamic import becomes unreachable, and no DialKit chunk
or stylesheet is emitted. A runtime check would still have shipped the bundle.

Three traps, all already sprung:

- **`VERCEL_ENV` has to be listed in `turbo.json`.** The Vercel build runs
  through `turbo`, which uses strict env mode: a variable the task does not
  declare is not merely unhashed, it is _absent_. So `vite.config.ts` read
  `undefined`, fell through to its `NODE_ENV` branch, and `vite build` sets
  `NODE_ENV=production` — which made `__DIALS__` false on preview deploys too,
  and no panel had ever actually shipped. Anything the build reads off
  `process.env` needs to be in the `build` task's `env` list.
- `DialRoot` hides itself when `NODE_ENV` is `production`, and a Vercel preview
  _is_ a production build — so it needs `productionEnabled`. Without it the
  chunk loads and renders nothing.
- The site-wide controls act through rules injected from `SiteDials.svelte`'s
  `<svelte:head>`, not from `app.css`, so production carries no trace of them.
  They are unlayered on purpose: that is what lets the measure rule outrank
  Tailwind's own `.max-w-6xl` in `@layer utilities`.

---

## The Header (`src/lib/NavBar.svelte`)

`position: sticky; top: 0`, in flow, and it never leaves — no auto-hide, no
condense. What it does instead of moving is read where the page is, and the
pieces of that are load-bearing:

- **`--nav-h` has to be a static value in `app.css`.** It is what
  `scroll-padding-top` is built from, and without that offset a `#hash` link
  landed its heading entirely behind the 56px bar and opened the page on the
  paragraph after it. The reason it cannot simply be measured is timing: the
  browser scrolls to a deep link while the document is still parsing, long
  before any script runs. `NavBar` re-publishes the row's measured height onto
  `documentElement` once it has one, so a row moved by the dials carries the
  anchor offset with it — but the shipped number lives in CSS.
- **The surface is a scroll-driven animation, not a scroll listener.** A
  `scroll(root block)` timeline on the shell carries `--nav-surface-scroll` from
  0 to 1 over `--nav-surface-range` (64px), and the tint and hairline fade with
  it. The listener is installed only where `CSS.supports('animation-timeline',
'scroll()')` is false, and drives the old on/off switch through
  `[data-scrolled]`.
- **`opacity: max(--nav-surface-scroll, --nav-surface-menu)`, and both are
  registered `@property` numbers.** The disclosure drops over page content from
  scroll offset 0, so it has to be able to paint the surface itself. Animating
  `opacity` directly cannot express that: an animation outranks every
  declaration for the property it runs on, so the open menu would have had
  nothing to say. Two inputs with their own timing — one on the scrollbar, one
  on a 200ms transition — composed by `max()`, is what lets opening the menu at
  the top and closing it again still fade.
- **The wordmark is handed over on the hero's own view progress, one to one.**
  The home page's hero `h2` declares `view-timeline-name: --nav-hero-name` with
  `view-timeline-inset: var(--nav-h) auto` — so the edge it measures against is
  the bottom of the header, not the top of the viewport — and `.nav-name-roll`
  animates across that subject's `exit`. However much of the hero name has gone
  under the bar is however much of the header's has arrived. `:root` carries the
  `timeline-scope`, because the two elements are siblings under `body`; the
  animation is gated on `[data-home='true']` rather than on the name failing to
  resolve, since `timeline-scope` keeps it alive-but-inactive everywhere.
  **There is deliberately no dial for the range** — a knob there is a knob for
  taking the two names out of step.
- **It lands _on_ the hero name, not merely in step with it.** The roll starts
  at `--nav-name-travel` — `(--nav-h + 2rem) / 2`, 44px — which is the gap
  between where the inset puts the hero name at the range's start and where the
  wordmark rests in the row. Anything else leaves the two names a constant 12px
  apart for the whole crossing, which is a double image over the few pixels
  where both are visible. **Two animations on the one timeline**, because the
  ranges differ: the fade runs `exit` (the hero's own 32px, so arrival tracks
  disappearance 1:1) and the rise runs `exit 0px exit var(--nav-name-travel)`
  (44px of travel over 44px of scroll — the page's own rate — landing in the
  row 12px after the hero is gone). One animation would mean writing the fade's
  end as `72.7%`, both variables baked into a number.
- **`.nav-name` is the hole `.nav-name-roll` moves through**, and it has to be a
  second element: the clip has to hold still while the type inside it moves, and
  a box that translates takes its own overflow with it. The observer fallback
  keeps the old 4px nudge — a roll reads as movement against the page and as a
  swoosh against a clock.
- **The hole has a soft lower lip, `--nav-name-portal` (20px)**, so the wordmark
  dissolves through a threshold instead of being sliced off by a clip edge. The
  lip is room opened _below_ the line box: `padding-bottom` adds it and an equal
  negative `margin-bottom` takes it back out of the layout, so the box that gets
  clipped and masked is taller than the box the row measures. The row stays 56px
  and `--nav-h` does not move.
- **The mask's solid end is pinned to `2rem`, the type's own line** — not
  measured up from the bottom edge. That is what makes a deeper lip a longer
  dissolve rather than a bite out of the wordmark: the resting name's ink ends
  at 30px of a 32px line (`fontBoundingBoxAscent` puts the baseline at 25, the
  `j` reaches 5 past it), so the ramp starts 2px under it at any depth. The
  resting name screenshots byte-identical with the mask and without it. Past
  12px the lip hangs below the hairline, which is only ever true while the name
  is moving, and every pixel of it is a pixel where the hero name is sitting in
  exactly the same place.
- **The fade is on the roll, not on the type.** The English and Korean spans
  cross-fade on their own `opacity` on hover, and an animation outranks every
  declaration for the property it runs on, so a scroll-driven `opacity` on the
  English span would have killed `group-hover:opacity-0` on the one page it
  runs. On the roll it multiplies through both. It also keeps the handover to
  `opacity` and `translate` alone, which is what keeps it on the compositor —
  the registered-property-and-`max()` shape the surface needs would not be.
- The global `prefers-reduced-motion` rule collapses every `animation-duration`
  to 0.001ms, which would strand a progress-timeline animation at one end. Both
  `.nav-shell` and `.nav-name` re-assert `animation-duration: auto` under that
  media query. A tint or a name tracking the scrollbar is the page moving, not
  motion of its own.

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
| `HEALTH_API_KEY`    | Apple Health ingest — the Shortcut's bearer token. Convex-side only; `/health` no longer reads it.             |
| `CONVEX_SITE_URL`   | Optional override. Convex HTTP actions live on the `.site` twin of `PUBLIC_CONVEX_URL`, derived automatically. |

`LAST_FM_PUBLIC_API_KEY` is a Convex-only env var — the feed cron reads it inside
the deployment, so it never needs to reach the SvelteKit app or Vercel.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
