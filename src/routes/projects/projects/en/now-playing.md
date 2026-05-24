---
title: 'Now Playing'
description: Apple Music listening data on my site — without the Apple Developer account.
year: '2023'
tags:
  - Python
  - GitHub Actions
  - Last.fm
published: true
---

## The short version

This repo ([injoon5/data](https://github.com/injoon5/data)) is the backend for the "now listening" widget on this site. It fetches what I'm playing from Last.fm and writes a JSON file that the frontend reads directly from GitHub.

I wrote the full story in [How I made the "Now Listening" section on my website](/blog/now-listening) — Apple Music API age limits, why I refused to switch to Spotify, Sleeve for scrobbling, and the CORS trick with `raw.githubusercontent.com`.

## The script

`now-playing.py` hits Last.fm's `user.getrecenttracks` endpoint with my username and API key from env, then writes the response to `now-playing.json`. It trims the track list to the **20 most recent** entries before saving (the blog post originally said 4 — I bumped it at some point).

```python
response['recenttracks']['track'] = response['recenttracks']['track'][:20]
```

Last.fm marks the currently playing track with `@attr: { nowplaying: "true" }` on the first item — the homepage widget checks for that.

## GitHub Actions

The workflow (`.github/workflows/update.yml`) runs **every 5 minutes** on a cron, and also on pushes to `main`. Each run:

1. Rebases from remote (`git pull` with rebase) to avoid push conflicts
2. Runs `photos.py` (separate widget — recent photos JSON)
3. Runs `now-playing.py` with `LAST_FM_PUBLIC_API_KEY` from secrets
4. Commits as `github-actions[bot]` if anything changed
5. Pushes via `ad-m/github-push-action` using a `REPO_SECRET` token

Keeping this in a separate repo means the bot can commit JSON on its own schedule without redeploying the website.

## How the site reads it

The homepage does a client-side fetch on mount:

```
https://raw.githubusercontent.com/injoon5/data/main/now-playing.json
```

Raw GitHub files have no CORS restrictions, so no backend proxy needed. If the fetch fails, the widget shows an error state instead of breaking the page.

No server. No cost. No $99/year developer account. Not bad for a workaround.
