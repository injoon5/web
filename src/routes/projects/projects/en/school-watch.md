---
title: 'SchoolWatch'
description: A watchOS app for the boring parts of school day — schedule, timing, glances.
year: '2024'
tags:
  - Swift
  - watchOS
published: true
---

<script>
	import LazyVideo from '$lib/LazyVideo.svelte';
</script>

## Why a watch app

I wear an Apple Watch most days. Pulling out my phone between classes to check the timetable or see how much time was left in the period felt dumb when the screen was *right there* on my wrist.

[SchoolWatch](https://github.com/injoon5/SchoolWatch) is my attempt to fix that — a watchOS app that hits the same [school API](/projects/timefor-school) as everything else, just on a 45mm display.

## Demo

<LazyVideo src="/videos/projects/schoolwatch-demo.mp4" label="Play SchoolWatch demo" />

The video only loads when you hit play — no upfront download on page load.

## App structure

`ContentView` is a vertical-page `TabView` with four tabs:

| Tab | View | What it shows |
| --- | ---- | ------------- |
| Today | `TodayView` | Today's classes + lunch menu |
| Timetable | `TimetableView` | Full week schedule |
| Meals | `MealView` | Next 15 days of lunch |
| Settings | `SettingsView` | Grade + class number |

Grade and class are stored in `UserDefaults` (defaults to 2학년 6반 if unset). Every network call builds a URL like:

```
https://school-api-1i8w.onrender.com/timetable?grade=2&classno=6
```

## Timetable details

`TimetableView` decodes the API's `TimetableData` shape — `day_time` (period start times), `timetable` (nested by day), `update_date`. Each `ClassSchedule` has period, subject, teacher, and a `replaced` flag. When a class was substituted, a yellow ⚠️ icon shows and the detail view displays the original subject/teacher in red.

It also fetches `/schedule` for the current week and overlays school events (공휴일, 행사) — if an event hits a day, that day shows the event name instead of the class list.

**Offline fallback:** timetable JSON gets cached in `UserDefaults` under `cachedTimetable`. If the network request fails, it loads from cache instead of showing a blank screen.

## Today + meals

`TodayView` checks the weekday first — Saturday/Sunday shows a big red **"NO SCHOOL TODAY!"** and skips the API calls. On weekdays it pulls today's row from the timetable and today's lunch from `/lunch?startdate=YYYYMMDD&enddate=YYYYMMDD`.

`MealView` fetches a 15-day window and lists each day's `DDISH_NM` (dishes, newline → comma) with calorie info.

## Status

Built in SwiftUI for watchOS. No backend of its own — pure client hitting the [TimeforSchool API](/projects/timefor-school). More of a personal tool than a polished App Store release, but I use it daily. The source is on GitHub if you want to poke around.
