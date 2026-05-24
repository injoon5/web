---
title: 'Class Info'
description: A real-time notice board for my homeroom — assignments, supplies, and announcements.
year: '2025'
tags:
  - SvelteKit
  - Convex
  - TailwindCSS
published: true
---

## The problem

Our class used to share homework and 수행평가 deadlines through KakaoTalk. It works until it doesn't — messages get buried, someone asks "what was due tomorrow?" for the fifth time, and the thread turns into chaos.

I wanted a single place everyone could check without scrolling through chat history.

## What I built

[Class Info](https://github.com/injoon5/class-info) is a notice board at [timefor.school](https://timefor.school). Notices are grouped by date, tagged by type (homework, supplies, performance assessments, etc.), and sync in real time through Convex — post something on the admin side and it shows up on everyone's phone immediately.

The admin panel is PIN-protected. I write notices in Markdown (images and YouTube embeds work), and the main page strips that down to a clean first-line preview so the list stays scannable.

It's very much built for *our* homeroom's workflow, but the stack — SvelteKit 5, Convex, Tailwind v4 in a small monorepo — is the same one I've been reaching for on other school-related projects.

## Related work

The same backend powers [timeforschool-mcp](/projects/timeforschool-mcp), which exposes timetable and lunch data to AI tools. Same ecosystem, different interface.
