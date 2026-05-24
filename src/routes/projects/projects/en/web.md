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

You're reading this on it. [injoon5/web](https://github.com/injoon5/web) is my personal site — the place for writing, project writeups, and the assorted experiments I don't want to lose to a Notion tab.

## Stack

- **SvelteKit** for pages and prerendering where it makes sense (blog posts, project listings).
- **Convex** for anything that needs to be live: comments with voting, page likes, the editable `/now` page.
- **Vercel** for hosting; OG images via my [OG API](/projects/og).
- **"Now listening"** via [Last.fm + GitHub Actions](/projects/now-playing) because Apple won't give high schoolers a developer account.

The comment system is probably the most complex part — bcrypt passwords for edits, IP hashing, rate limits in Convex, admin dashboard for bans and replies. I migrated it off a SQL + Redis setup specifically so realtime subscriptions would Just Work™.

## Why I keep rebuilding it

This is version… many. There was Raster, Next.js iterations, Ghost themes, the whole [oij-web](https://github.com/injoon5/oij-web) era. I finally settled on owning the whole stack again instead of fighting a CMS.

It's never done. But it's mine, and that's the point.
