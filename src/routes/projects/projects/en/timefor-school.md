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

### Notices

The Convex `notices` table stores title, subject, type (`수행평가` / `숙제` / `준비물` / `기타`), Markdown description, due date, and optional file attachments (stored in R2). Each notice gets a random 5-letter slug for shareable detail URLs.

The main page doesn't dump full Markdown. `summarizeDescription()` takes the first line, strips leading `#` headers, and replaces `![alt](url)` image syntax with the alt text (or filename). Keeps the list scannable on a phone.

Grouping is where it gets school-specific. There's a **16:00 KST cutoff** — after 4 PM, "today" effectively becomes tomorrow for due-date sorting. Notices show as `오늘`, `내일`, or `M/D (요일)`. Past notices roll into month buckets (`2025년 3월`, etc.).

Admin is PIN-protected. Realtime sync via Convex subscriptions — post on admin, everyone sees it instantly.

### Timetable, meals, schedule

Class Info isn't just notices. The same Convex backend caches timetable, lunch menus, and school calendar data in separate tables (`timetables`, `meals`, `schedules`). Cron jobs refresh them hourly:

- Timetable this week + next week (via internal `timetable.fetchAndSave`)
- Meals this week + next week
- Schedule window daily at 03:00 UTC

That way the website can show lunch and calendar info instantly, without hammering the API on every page load.

Stack: SvelteKit 5, Convex, Tailwind v4, Turborepo monorepo (`apps/web` + `packages/backend`).

## School API

[school-api](https://github.com/injoon5/school-api) is the FastAPI backend. I called it **SchoolKit** in the OpenAPI docs.

Two data sources, which took me a while to figure out:

1. **Timetable** — scraped from [comci.net](http://comci.net) via `timetable_api.py`. The `TimeTable` class reverse-engineers their JS API: regex-parses session codes from the page, base64-encodes the school/week params, and builds a nested `[grade][class][day][period]` structure. It also tracks **substitute classes** — when `replaced: true`, the response includes the original subject/teacher.

2. **Lunch + schedule + school lookup** — NEIS open API through `neispy`. Meal dish names get parenthetical allergen tags stripped and spaces converted to newlines for readability.

Endpoints:

| Route            | What it does                                  |
| ---------------- | --------------------------------------------- |
| `GET /timetable` | Grade, class, week (0/1), school code or name |
| `GET /lunch`     | `startdate` / `enddate` as `YYYYMMDD`         |
| `GET /schedule`  | School calendar events in a date range        |
| `GET /school`    | Lookup by school name                         |
| `GET /classes`   | Class numbers for a grade                     |

CORS is locked to `timetable.injoon5.com` and localhost. Lives at [api.timefor.school](https://api.timefor.school).

## TimeforSchool MCP

Once the API was stable, I wanted to ask Claude "what's for lunch this week" without opening a browser. [timeforschool-mcp](https://github.com/injoon5/timeforschool-mcp) wraps the same endpoints as MCP tools via [xmcp](https://xmcp.dev):

- **`timetable`** — Zod-validated params (`grade`, `classno`, `week`, `schoolcode` defaulting to `7081492`). Read-only, idempotent.
- **`lunch`** — date range + school code. Same annotations.

HTTP transport at [timeforschool-mcp.vercel.app](https://timeforschool-mcp.vercel.app); stdio build for local clients.

Still experimenting with whether I use this daily or it's just a cool demo. Jury's out.

## Repos

| Piece                      | GitHub                                                                    |
| -------------------------- | ------------------------------------------------------------------------- |
| Notice board + cached data | [injoon5/class-info](https://github.com/injoon5/class-info)               |
| NEIS + comci API           | [injoon5/school-api](https://github.com/injoon5/school-api)               |
| MCP server                 | [injoon5/timeforschool-mcp](https://github.com/injoon5/timeforschool-mcp) |
