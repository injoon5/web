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

I wrote the full story in [How I made the "Now Listening" section on my website](/blog/now-listening) — Apple Music API age limits, why I refused to switch to Spotify, Sleeve for scrobbling, the GitHub Actions cron job, and the CORS trick with `raw.githubusercontent.com`.

## Why it's a separate project

Keeping the fetch script out of the main site repo means the workflow can commit updated `now-playing.json` on its own schedule without redeploying the whole website. Every five minutes, Last.fm → Python → JSON → commit. The site just fetches the file.

No server, no cost, no $99/year developer account. Not bad for a workaround.
