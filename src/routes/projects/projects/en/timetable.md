---
title: 'Timetable'
description: A customizable school timetable for Korean middle and high schools.
year: '2025'
tags:
  - Next.js
  - TypeScript
  - Zustand
published: true
---

## Why I built it

Korean school timetables are one of those things that should be simple and somehow aren't. You can look them up through NEIS, but the official UI is clunky on a phone, and most of the third-party apps I've tried feel either outdated or overloaded with ads.

I wanted something I could actually open between classes — pick my grade and class number, see this week and next week, and move on. So I built [timetable](https://github.com/injoon5/timetable).

## What it does

The app pulls schedule data from the school API, then lets you customize how it looks: which days to show, layout preferences, that kind of thing. State lives in Zustand so it persists without a backend of my own.

Stack-wise it's Next.js with shadcn/ui. Nothing fancy on purpose — the goal was a fast, readable timetable, not a platform.

## Status

It's in a "general usage ready" state: you can use it today at [timetable-injoon5.vercel.app](https://timetable-injoon5.vercel.app). A proper full-stack version (accounts, saved configs across devices, ~~maybe charge money for premium themes~~) is still on the todo list. We'll see.
