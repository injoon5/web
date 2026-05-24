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

Postfix maps cleanly onto a **stack** data structure. Read left to right: push numbers, when you hit an operator pop two values, compute, push result. No parentheses, no order-of-operations ambiguity. That's why it's used in bytecode, calculators, and expression parsers.

Infix is what humans prefer because it matches how we speak. Postfix is what machines prefer because it's unambiguous and easy to evaluate in one pass.

## What I built

Python scripts that:

1. **Convert postfix → infix** using a stack
2. **Evaluate postfix expressions** by pushing/popping operands

Both use the stack pattern — push numbers, on operator pop two, apply, push result.

![Research overview](/images/uploads/projects/postfix-notation/main.png)

![Stack conversion](/images/uploads/projects/postfix-notation/part-1.png)

![Evaluation walkthrough](/images/uploads/projects/postfix-notation/part-2.png)

![Code examples](/images/uploads/projects/postfix-notation/part-3.png)

![Results](/images/uploads/projects/postfix-notation/part-4.png)

## Context

This was a research project from around 2020 — early middle school, before I was building web apps. But understanding stacks and expression parsing showed up again later when I actually needed to parse things in real projects.
