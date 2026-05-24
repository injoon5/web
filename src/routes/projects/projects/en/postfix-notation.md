---
title: 'Postfix Notation Research'
description: Why computers use postfix notation — and Python code to convert and evaluate it with stacks.
year: '2020'
tags:
  - Python
published: true
---

## Why I looked into this

In math class you write `3 + 4` — operator between operands. That's **infix** notation. But if you've ever looked at a compiler or a HP calculator, you've seen `3 4 +` instead. **Postfix** (reverse Polish) notation puts operators after operands.

I wanted to know *why* computers prefer it, not just that they do.

## What I found

It turns out postfix maps cleanly onto a **stack**. Read left to right: push numbers, and when you hit an operator pop two values, compute, push the result. No parentheses, no order-of-operations ambiguity. That's exactly why it shows up in bytecode, calculators, and expression parsers.

Infix is what humans like because it matches how we speak. Postfix is what machines like because it's unambiguous and you can evaluate it in a single pass.

## What I built

Python scripts that:

1. **Convert postfix → infix** using a stack
2. **Evaluate postfix expressions** by pushing and popping operands

Both lean on that same stack pattern — it's the whole trick, really.

![Research overview](/images/projects/postfix-notation/main.png)

![Stack conversion](/images/projects/postfix-notation/part-1.png)

![Evaluation walkthrough](/images/projects/postfix-notation/part-2.png)

![Code examples](/images/projects/postfix-notation/part-3.png)

![Results](/images/projects/postfix-notation/part-4.png)

## Context

This was a research project from around 2020 — early middle school, well before I was building web apps. At the time it felt like a detour, but stacks and expression parsing kept showing up later whenever I actually needed to parse something in a real project.
