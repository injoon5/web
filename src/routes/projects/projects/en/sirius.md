---
title: 'Sirius App'
description: A school dashboard app — timetable, notices, and class info in one place. Started at Gifted Education Center.
year: '2022'
tags:
  - Swift
  - Python
  - Next.js
published: true
---

## What it was

**Sirius** (`학교 정보를 한눈에` — "school info at a glance") was a school life app I built at [Gifted Education Center](https://github.com/injoon5/sirius-web). The idea: one place for timetable, announcements, and whatever else you need between classes, instead of juggling three different apps and a KakaoTalk thread.

The original target was a native **Swift** app with a **Python** backend for scraping/processing school data. What's on GitHub is the web prototype: [sirius-web](https://github.com/injoon5/sirius-web), a Next.js + Tailwind dashboard.

## The web prototype

Built on StackBlitz, exported to GitHub. The homepage is a simple grid layout:

- Header: **Sirius** + tagline
- Profile card (avatar, name, school — hardcoded to 이대부속초등학교 in the demo)
- 3×3 grid of numbered tiles (`01`–`09`) — placeholders for timetable, lunch, homework, etc.

Settings and logout links are… rickrolls. (`youtube.com/watch?v=dQw4w9WgXcQ`.) I was 13.

Stack: Next.js pages router, Tailwind CSS, no backend wired up in the public repo. It was more UI mockup than functional product at this stage.

## What happened next

Sirius didn't ship as a standalone app, but the idea clearly stuck — years later I rebuilt the same concept as [TimeforSchool](/projects/timefor-school) (notice board + timetable + lunch API + MCP) and [SchoolWatch](/projects/school-watch) (watchOS client). Same problem, better stack, actually deployed.

The Sirius name, grid-dashboard concept, and "school info at a glance" pitch are basically the ancestor of everything school-related on this site.

Made at Gifted Education Center, 2022.
