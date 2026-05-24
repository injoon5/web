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

[og](https://github.com/injoon5/og) is a small API that generates social preview images from query parameters — title, subheading, that kind of thing. Live at [og.ij5.dev](https://og.ij5.dev).

Example:

```
https://og.ij5.dev/api/og/?title=Generate%20Images%20on%20the%20Fly!&subheading=Hello%2C%20World!
```

This site uses it for project and blog cards (you can see the pattern in the OG meta tags on those pages).

## How it's built

It's basically the [Vercel OG + Next.js example](https://github.com/vercel/examples/tree/main/edge-functions/og-image-generation) with my typography and layout tweaks. `@vercel/og` renders JSX to PNG at the edge; no image files to maintain.

I forked it because I got tired of hand-designing every preview in Figma. Now I change a URL and redeploy nothing.
