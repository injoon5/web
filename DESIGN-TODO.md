# Design TODO — deferred items

Items from the master-design-engineer review that we agreed to come back to.
Everything in this file is currently **un-implemented**. Items currently
shipped on `claude/codebase-design-review-w329m` are intentionally not listed.

---

## Font / typography overhaul _(deferred — revisit first next time)_

All of this was held back to avoid stacked changes; let's tackle it as a
single pass so the type system stays coherent.

- **Reorder font stack** — `src/app.css:12-14` puts `-apple-system` before
  `'Interlude Variable'`. On Apple devices that means San Francisco wins
  and Interlude never renders. Interlude should come first; SF / Segoe
  stay as fallbacks for users who lack the variable font.
- **Preload Interlude** — currently loaded via `@import` inside `app.css`,
  which is render-blocking through a CSS dependency chain. Move to a
  `<link rel="preload" as="style">` in `app.html` so the font request kicks
  off in parallel with the rest of the page.
- **Define a real type scale** — pick ~6 sizes (eyebrow / body / lede /
  h3 / h2 / h1 / display), 3 weights (400 / 500 / 600), and 3 tracking
  values (display / body / eyebrow). Apply across the site so post titles,
  page titles, and section headings stop competing.
- **Tracking audit** — `tracking-tight`, `tracking-normal`, and
  `-tracking-normal` (which is a no-op since `tracking-normal` = `0em`)
  are sprinkled inconsistently. Pick one rule per role and stick to it.
- **Drop the mono "Hello World" eyebrow** (`src/routes/+page.svelte:87`)
  in favour of a single eyebrow-style token, or replace with a serif
  hero treatment for the name.
- **Subtitle metadata on post pages** — date / reading time are currently
  rendered at `text-xl` / `text-2xl`, which competes with the post title.
  After the type pass these should drop to small uppercase tracked
  eyebrow style instead.

---

## Off-black / off-white text _(maybe next time)_

`src/app.html:36` uses `text-black` on `bg-white` and `text-white` on
`bg-neutral-950`. Pure `#000` on `#fff` is harsh. Switch globally to
`text-neutral-900 dark:text-neutral-100` to soften without losing
contrast.

---

## Spacing rhythm _(deferred)_

Every major section on `+page.svelte` uses the same `mt-20 mb-12`.
Introduce a 3-tier rhythm:

- intro → first section: `mt-24`
- section → section: `mt-32`
- within a section: `mt-12`

Same with the footer (`+layout.svelte:64`): `mt-32 pt-12 border-t`
gives it room to breathe.

---

## Dead / typo'd Tailwind classes _(deferred — touching these can shift layout)_

These currently silently no-op. Removing them shouldn't change anything
visually, but it could expose hidden assumptions, so do them in a single
sweep with eyes on the affected pages:

| File:line                          | Class                                       | What it should be / do         |
| ---------------------------------- | ------------------------------------------- | ------------------------------ |
| `src/routes/+page.svelte:83`       | `sm:text-normal`                            | not a class — delete           |
| `src/routes/+page.svelte:134, 192` | `font-neutral-900`, `dark:font-neutral-100` | meant `text-…` — fix or delete |
| `src/routes/+page.svelte:360`      | `lg:text-bas`                               | typo — `lg:text-base`          |
| `src/routes/blog/+page.svelte:40`  | `text-md`                                   | not a class — delete           |
| `src/routes/+page.svelte:213`      | `-tracking-normal`                          | no-op — delete                 |

Plus the giant commented-out blocks at `+page.svelte:283-302` and
`blog/+page.svelte:45-62` — confirm dead, delete.

---

## Smaller items still on the table

These came up in the review but weren't on the implementation list yet.
Not blocking; queue them for a future pass.

- **`LayoutDefault.svelte`** is a one-line `<slot />` passthrough — delete
  and any consumers.
- **`PostLink.svelte`** appears unused (home / blog / projects each have
  their own list rendering). Confirm and delete.
- **Tech-stack grid math** at `+page.svelte:240-262` uses
  `grid-cols-4 sm:grid-cols-8 md:grid-cols-12` with every child spanning
  `col-span-4`, which always gives 1/2/3 columns. Collapse to
  `grid-cols-1 sm:grid-cols-2 md:grid-cols-3` for readability.
- **`<meta name="theme-color">`** is set statically in `app.html:29-30`;
  it doesn't follow a manual theme toggle (when one ships).
- **JSON-LD `BlogPosting`** schema on blog posts — pure SEO win.
- **`<link rel="alternate" type="application/rss+xml">`** in `<head>`
  pointing at `/internal/rss.xml` so feed readers auto-discover.
- **Twitter card meta** (`twitter:card`, `twitter:image`) missing
  everywhere — small SEO win.
- **Copyright year** in `+layout.svelte:105` is hard-coded `2026`. Switch
  to `new Date().getFullYear()`.
- **Footer icons** — Email / GitHub / RSS lack icons; small lucide
  monolines would help scanning.
- **TableOfContents** label is currently `text-[10px]`. Bump to 11px once
  the type scale is defined.
- **Series posts in `/blog`** could swap the `ml-6` indent for a left
  border guide for a stronger visual anchor.
- **NumberFlow / view counter** — once page views start meaningful,
  consider exposing them on the blog index too (`/blog` list rows).
- **`now.js` `marked.parse` defensive sanitization** — content is
  admin-only today, but adding DOMPurify protects against future regression.

---

## What we explicitly ship-decided _not_ to do

Keeping a record so we don't re-litigate.

- Theme toggle UI (system / light / dark tri-state).
- Signature accent color across the site.
- Replacing the `→` glyph in "Read all Posts" / "View all Projects" /
  "View all Photos" with an SVG arrow.
- Page-transition crossfade / View Transitions API.
- Hover-lift micro-interaction on the homepage post / project cards.
