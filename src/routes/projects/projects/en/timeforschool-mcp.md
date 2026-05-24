---
title: 'Time for School MCP'
description: An MCP server so AI assistants can query our class timetable and lunch menu.
year: '2025'
tags:
  - TypeScript
  - MCP
published: true
---

## The idea

Once [Class Info](/projects/class-info) and the school API were live, I kept thinking: what if I could ask Claude "what's for lunch this week" or "what's third period on Tuesday" without opening a browser?

[MCP](https://modelcontextprotocol.io) is the obvious answer — expose the same data as tools an assistant can call.

## What's in it

[timeforschool-mcp](https://github.com/injoon5/timeforschool-mcp) is built with [xmcp](https://xmcp.dev). Two tools matter:

- **`timetable`** — grade, class number, this week or next, school code. Hits `api.timefor.school/timetable`.
- **`lunch`** — date range and school code. Hits `api.timefor.school/lunch`.

Both are read-only and idempotent, which is what you want when an LLM is poking at your APIs.

Deployed at [timeforschool-mcp.vercel.app](https://timeforschool-mcp.vercel.app) for HTTP transport; there's a stdio build too if you want to wire it into a local client.

## Honest take

Most of the boilerplate is from `create-xmcp-app`. The interesting part was deciding what to expose and keeping the schemas strict enough that the model doesn't hallucinate parameters. Still experimenting with whether this is actually useful day-to-day or just a cool demo — jury's out.
