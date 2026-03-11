---
type: blog
title: How I made the "Now Listening" section on my website
slug: '{{slug}}'
description: 'Not using the Apple Music API and finding a cool trick involving Last.fm and GitHub Actions. '
date: '2025-02-09'
coverimage: ''
published: true
---

## The idea

A while back I was browsing [cho.sh](https://cho.sh), Sunghyun Cho's personal site, and noticed this really cool "now playing" section that shows what music they're currently listening to — live, on the website. I immediately wanted one.

So I started looking into how to actually build it.

## The problem: Apple Music API

I'm an Apple Music user. Have been for years. Naturally I went to look up the Apple Music API to pull in my listening data — and yeah, you need an Apple Developer account for that.

Apple Developer accounts cost $99/year, which, fine, that's whatever. The real issue is that **you have to be 18 or older to get one.** I'm in high school. So that's a hard no.

## Option 1: Switch to Spotify?

Spotify's API is free and doesn't have age restrictions. So theoretically I could just... switch.

![Spotify's cluttered, algorithmically-poisoned UI](/images/uploads/spotify-ui.png)

No. Absolutely not. I refuse. Spotify's recommendation algorithm has been broken for years, the UI is a mess, and I genuinely do not want to give up Apple Music's sound quality and ecosystem just so I can call a REST API. Hard pass. Moving on.

## Option 2: Last.fm

[Last.fm](https://www.last.fm) is a music tracking service that's been around since 2002. The way it works: you connect it to your music player, and it "scrobbles" (logs) every track you listen to. It has a free API with no age restrictions.

The key part: **Apple Music can sync to Last.fm.** Every song I play on Apple Music automatically gets scrobbled to my Last.fm profile. Problem solved (kind of — there's still the matter of actually fetching and displaying the data, but at least I have a data source now).

## Sleeve

To actually enable the Apple Music → Last.fm sync on macOS, I used an app called [Sleeve](https://replay.software/sleeve).

[![Sleeve app icon](https://replay.software/sleeve/images/sleeve-icon.png)](https://replay.software/sleeve)

Sleeve is a tiny macOS app that sits on your desktop and shows the currently playing track with album art. It looks really clean:

![Sleeve showing album art on the desktop](/images/uploads/sleeve-example.png)

More importantly for our purposes, Sleeve has a Last.fm scrobbling toggle built in. Turn it on, connect your Last.fm account, and every song you play in Apple Music gets logged automatically. It just works.

## The Python script

Once Last.fm is getting my listening history, I need to actually fetch it and store it somewhere my website can read it.

Last.fm has a [`user.getrecenttracks`](https://www.last.fm/api/show/user.getrecenttracks) endpoint that returns your most recently played tracks, and if a track is currently playing it gets flagged with `@attr: { nowplaying: "true" }`. Perfect.

I wrote a short Python script to hit that endpoint and write the result to a JSON file:

```python
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

url = f'http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=injoon5&api_key={os.environ["LAST_FM_PUBLIC_API_KEY"]}&format=json'

headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
}

def get_now_playing():
    result = requests.get(url, headers=headers)
    return result

if __name__ == '__main__':
    response = get_now_playing().json()
    response['recenttracks']['track'] = response['recenttracks']['track'][:4]

    with open('now-playing.json', 'w') as f:
        json.dump(response, f, indent=2)
```

The full script (along with the GitHub Actions workflow) lives at [github.com/injoon5/data](https://github.com/injoon5/data).

## GitHub Actions to the rescue

The script runs every 5 minutes via a GitHub Actions workflow. It fetches the latest data from Last.fm, writes it to `now-playing.json`, and commits the result back to the repo.

This means `now-playing.json` is always up to date — or at most 5 minutes behind.

## The CORS thing

Here's where it gets neat. Raw files served from GitHub (`raw.githubusercontent.com`) don't have CORS restrictions. So my website can fetch `now-playing.json` directly from GitHub without needing any backend or serverless function on my end.

The whole thing is basically:

1. I listen to music on Apple Music
2. Sleeve scrobbles it to Last.fm
3. GitHub Actions fetches it every 5 minutes and writes a JSON file
4. My website fetches that JSON file directly from GitHub
5. The "now listening" widget updates

No server. No cost. No Apple Developer account required.

Not bad for a workaround.
