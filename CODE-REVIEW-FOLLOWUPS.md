# Code Review Follow-ups — deferred items

Findings from the full-codebase review that were **not** changed because they are
architectural, need a design decision, or are already tracked in
`DESIGN-TODO.md`. Everything else from the review was fixed in place.

## Security — architectural / needs a decision

1. **`ipHash` is a client-supplied argument on every public Convex function.**
   `comments.create`/`vote`, `likes.setLike`, `commentActions.editComment`/
   `softDeleteComment` all accept `ipHash` directly (Convex exposes no request
   IP), so a direct caller can mint a fresh hash per request and defeat the rate
   limiter (`convex/rateLimits.js`), IP bans (`convex/lib/bans.js`), and
   one-vote/one-like dedup. `create` carefully re-validates `text`/`username`
   server-side "so direct callers can't bypass Zod" but trusts the far more
   impactful `ipHash`. Fixing this means moving trust to an authenticated
   context (e.g. server-only mutations keyed by a request-scoped identity), not a
   one-line change.

2. **`PATCH /api/comments/[id]` bypasses the password for any admin-cookie holder**
   (`src/routes/api/comments/[id]/+server.js` → `password: admin ? '' : password`).
   The sibling `DELETE` route was deliberately changed to _never_ branch on admin.
   Whether PATCH should keep the admin bypass (site owner fixing typos) or match
   DELETE is a product decision.

3. **The `admin_token` session cookie is a full write credential.**
   `verifyAdminSecret` accepts the cookie (`src/lib/server/admin.js`), and every
   `/api/admin/*` write routes through `requireAdmin` — so a leaked non-httpOnly
   24h cookie grants hard-delete/ban/reply. This is required for the dashboard
   (its writes use cookie-only `apiFetch`), but contradicts CLAUDE.md's "It buys
   read access … every write still goes through `/api/admin/*` where the real
   secret stays." Decide and re-document.

4. **`ip.js` trusts the leftmost `X-Forwarded-For` when `x-real-ip` is absent**
   (`src/lib/server/ip.js:18-19`), contradicting its own comment on `:12-14`.
   On a host that doesn't set `x-real-ip` this is an identity-forgery vector for
   rate limits and bans. Needs a deployment-aware decision (Vercel headers vs a
   generic reverse-proxy).

5. **`/api/og` is an un-rate-limited CPU renderer.** Text is length-bounded but
   render _count_ is not, and every distinct query string is a fresh satori+resvg
   rasterization. Rate limiting here needs a design (the existing limiter is
   Convex-side and keyed on `ipHash`, which this route doesn't compute).

6. **OG fonts are fetched from `url.origin`** (`src/lib/og/fonts.js`), derived
   from the request `Host` — a blind-SSRF vector if ever run behind a proxy that
   trusts `X-Forwarded-Host`. Fix is to pin the font origin to a constant/env var.

7. **Admin login has no rate limiting or lockout**
   (`src/routes/admin/+page.server.js`). The check is constant-time, but online
   brute-force is unbounded. Needs a SvelteKit-side limiter (the Convex limiter
   isn't reachable from the login action without plumbing an ipHash).

## Convex correctness — schema / design changes

8. **`readLatest` drops metrics older than the 500-row scan window**
   (`convex/lib/healthReads.js`, `LATEST_SCAN_LIMIT = 500`). With ~64 metrics
   written daily, a metric last recorded > ~8 days ago disappears from the
   `/health` summary. The right fix is a per-metric latest (or a denormalized
   "latest per metric" table), not a bigger scan limit.

9. **One-row tables have no uniqueness guarantee** (`nowPage`, `nowPlaying`,
   `photos` in `convex/now.js`/`feeds.js`). Concurrent first-writes create orphan
   rows. Convex has no unique index, so this needs a canonical-id pattern (a
   fixed `_id` or a `unique: true` guard on insert).

10. **Interrupted hard-delete is not resumable** (`convex/comments.js` —
    `hardDelete` returns early when the root already has `deletedAt`). A lost
    scheduler continuation after the first batch orphans descendants forever.
    Fixing means re-checking the subtree rather than the root, or recording the
    frontier.

## Convex performance — trade-offs

11. **`comments.list` does an unbounded `.collect()`** (`convex/comments.js:75-78`),
    a public subscription that reads the whole thread to rank/truncate to 200 in
    JS. Bounding it while keeping whole-thread inclusion is a real change.

12. **Legacy (pre-backfill) vote/like recounts** — `countAllVotes`
    (`convex/lib/votes.js`) and `readLikeCount`'s full-URL scan
    (`convex/lib/likeCounts.js`) run per render until the backfill flag is set.
    These disappear once backfill completes; no code change, just run the backfill.

## Frontend — minor / preference

13. **`NumberFlow` re-animates** per-comment scores and like counts on every
    websocket update (`CommentNode.svelte`, `LikeButton.svelte`). A plain
    `{value}` is cheaper; the animation is a deliberate choice.

14. **`LikeButton` hardcodes the label width** (`width: '40px'/'30px'`,
    `LikeButton.svelte:234`). Fine today; clips if the font or locale changes.

15. **`web-haptics` stays a static import** in the root layout
    (`src/routes/+layout.svelte`), unlike `onedollarstats` which was made
    dynamic. It is small and its `trigger` runs in a synchronous click handler,
    so lazy-loading it would complicate the handler for little gain.

## Dependency / environment

16. **`nanoid@3.3.17` (high severity, GHSA-2v37-7h3g-55p8)** — dev-only, via
    `eslint-plugin-svelte → postcss`. Not runtime-exploitable; `npm audit fix`
    may or may not have a clean path without a major bump.

17. **Node engine mismatch** — the project pins `node >=22.12 <25`, but this
    machine has node 26 (install needs `--engine-strict=false`), and the local
    npm cache has root-owned files (`sudo chown -R 501:20 ~/.npm`).

## Already tracked in `DESIGN-TODO.md` (not touched)

Font-stack ordering/preload, type scale, typo'd dead Tailwind classes
(`font-neutral-900`, `sm:text-normal`, `lg:text-bas`, `text-md`,
`-tracking-normal`), spacing rhythm, hard-coded copyright year, RSS
auto-discovery, Twitter card meta, JSON-LD `BlogPosting`, footer icons, and the
TechStack grid math are all already listed there.
