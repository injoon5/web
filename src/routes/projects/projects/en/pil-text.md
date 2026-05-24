---
title: 'Pil Text Generator'
description: Turn short text into styled PNG images — built for Discord, powered by Pillow and FastAPI.
year: '2021'
tags:
  - Python
  - FastAPI
  - Pillow
published: true
---

## What it is

[Pil Text Generator](https://github.com/injoon5/pil-discord-txt) (`pil-discord-txt`) takes a string and renders it as a PNG with a chosen font and color. Originally made so I could post styled text in Discord without relying on Nitro formatting.

The core logic lives in `textimg.py`; `main.py` wraps it in a FastAPI server.

## How it works

`gen(text, color, font)` does the rendering:

1. Load a TrueType font from `fontDict` — **10 Korean fonts** (Nanum Gothic, Lotte Mart Dream, Gugi, IBM Plex Sans KR, Seoul Namsan, Spoqa Han Sans Neo, etc.)
2. Measure text size with `font.getsize()`, create a transparent RGBA canvas
3. Draw with `ImageDraw.text()` — white/colored fill, **3 px stroke outline**, anchored right-middle (`anchor="rm"`)
4. Save to `pil_text.png`

Colors live in `colorDict` — each entry has a `stroke` and `color` tuple. Options include `original` (Discord dark-theme white-on-gray stroke), `blurple` / `blurple_old` (the two Discord purples), plus red/green/yellow/blue/pink/grey/white/black.

## The API

FastAPI app, version 0.1.5:

```
GET /{text}?font=nanum&color=original
```

- Max **10 characters** — longer text returns an error image (`10자 까지만 허용`)
- Invalid font/color combo → `요청이 잘못되었습니다.`
- Returns the PNG directly via `FileResponse`
- Shortcut route `GET /g/{text}` redirects to the query-param version

Runs on uvicorn port 8080. Managed with Poetry (`pyproject.toml`).

There's also [dctxt2img-client](https://github.com/injoon5/dctxt2img-client) — a simple HTML frontend that hits the API — but the generator itself is the interesting part.

## Why Pillow

Discord messages are plain text. I wanted something that looked like a designed card — custom fonts, stroke outlines, transparent background — without opening Figma every time. Pillow's `stroke_width` + `stroke_fill` params made the outlined text effect trivial once the font files were in place.

It's a small tool, but I used it constantly for a while. These days Discord has more native formatting, but the API still runs if you need it.
