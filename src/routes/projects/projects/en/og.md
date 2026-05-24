---
title: 'OG Image API'
description: On-the-fly Open Graph images for links, built on Vercel OG.
year: '2026'
tags:
  - Next.js
  - TypeScript
published: true
---

## What it is

[og](https://github.com/injoon5/og) is a standalone API that generates social preview images from URL query params. Live at [og.ij5.dev](https://og.ij5.dev).

```
https://og.ij5.dev/api/og/?title=Generate%20Images%20on%20the%20Fly!&subheading=Hello%2C%20World!
```

Hit that URL and you get a 2400×1260 PNG — title on top, subheading below, dark background.

## How it's built

Single Next.js API route at `pages/api/og.tsx`, running on the **Edge runtime**. Uses `@vercel/og`'s `ImageResponse` to render JSX to PNG.

On each request it fetches three font files in parallel from a CDN:

- **Pretendard SemiBold** — Korean/Latin body text
- **Noto Sans SC Bold** — simplified Chinese fallback
- **Noto Sans TC Bold** — traditional Chinese fallback

Query params `title` and `subheading` are sliced to 150 chars max. Defaults to `"Generate Images on the Fly :)"` / `"Hello, World!"` if missing.

## vs. this site's built-in OG

injoon5.com also generates OG images internally via `src/lib/og/templates.js` — satori templates at 1200×630 with a dot-grid background, different layouts for blog posts vs. projects vs. the homepage. Those hit `/api/og?template=...` on this domain.

The external `og.ij5.dev` service is the simpler, generic version — useful when I just need a title + subtitle image without redeploying the main site. I forked it from the [Vercel OG example](https://github.com/vercel/examples/tree/main/edge-functions/og-image-generation) and stopped hand-designing previews in Figma.
