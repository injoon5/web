---
title: 'TimeforSchool'
description: School tools for my homeroom — NEIS API backend, a realtime notice board, and an MCP server.
year: '2025'
tags:
  - SvelteKit
  - Convex
  - Python
  - FastAPI
  - MCP
published: true
---

## The idea

School life runs on a few repeating questions: what's due tomorrow, what's for lunch, what's third period on Tuesday. Our class used to answer all of that through KakaoTalk — which works until messages get buried and someone asks the same thing for the fifth time.

**TimeforSchool** is the bundle of tools I built around that problem. Same brand ([timefor.school](https://timefor.school)), three repos, one ecosystem.

## Class Info

[class-info](https://github.com/injoon5/class-info) is the homeroom notice board — the thing people actually open on their phones.

Notices are grouped by date, tagged by type (homework, supplies, performance assessments, etc.), and sync in real time through Convex. Post something on the admin side and it shows up for everyone immediately. The admin panel is PIN-protected; I write in Markdown (images and YouTube embeds work), and the main page strips that down to a clean first-line preview so the list stays scannable.

Stack: SvelteKit 5, Convex, Tailwind v4 in a small monorepo. Very much tuned to *our* homeroom's workflow, but it's the main frontend for the project.

## School API

[school-api](https://github.com/injoon5/school-api) is the backend — a FastAPI wrapper around the Korean NEIS open API (via `neispy`). I called it **SchoolKit** in the code.

Endpoints:

- **`/timetable`** — grade, class number, this week or next
- **`/lunch`** — meal menus for a date range
- **`/schedule`** — school calendar events
- **`/school`** and **`/classes`** — lookup helpers

It lives at [api.timefor.school](https://api.timefor.school) (deployed from the repo at [school-api-ten.vercel.app](https://school-api-ten.vercel.app)). Class Info doesn't own timetable data; this service does.

## TimeforSchool MCP

Once the API was stable, I wanted to ask Claude "what's for lunch this week" without opening a browser. [timeforschool-mcp](https://github.com/injoon5/timeforschool-mcp) exposes the same data as MCP tools — built with [xmcp](https://xmcp.dev):

- **`timetable`** — hits `api.timefor.school/timetable`
- **`lunch`** — hits `api.timefor.school/lunch`

Both are read-only and idempotent. HTTP transport at [timeforschool-mcp.vercel.app](https://timeforschool-mcp.vercel.app); stdio build if you want it in a local client.

Still experimenting with whether I use this daily or it's just a cool demo. Jury's out.

## Repos

| Piece | GitHub |
| ----- | ------ |
| Notice board | [injoon5/class-info](https://github.com/injoon5/class-info) |
| NEIS API | [injoon5/school-api](https://github.com/injoon5/school-api) |
| MCP server | [injoon5/timeforschool-mcp](https://github.com/injoon5/timeforschool-mcp) |
