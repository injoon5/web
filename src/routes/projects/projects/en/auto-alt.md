---
title: 'AutoAlt'
description: A browser extension that describes shoe images for screen reader users — built at the LG AI Youth Camp.
year: '2024'
tags:
  - Python
  - YOLOv8
  - FastAPI
  - GPT-4
published: true
---

## The problem

Visually impaired people shopping online often hit a wall with product images. Screen readers need **alt text** to describe what's on screen — and most shopping sites don't have it. You can't tell two pairs of shoes apart if the page just says "image" twelve times.

Our team spotted this during the [LG AI Youth Camp](https://www.lgdlab.or.kr/) in 2024 — a program run by LG Discovery Lab and Seoul National University. We spent about three months building a solution.

## What we built

**AutoAlt** takes a product image, runs it through a custom object detection model, then pipes the result to GPT-4 for a natural-language description. The final output is text a screen reader can actually read.

We narrowed the scope a lot over the project. Started with "all clothing on shopping sites," ended at **shoes** — the only category we could train reliably in the time we had.

### Stack

- **YOLOv8** trained on my MacBook Pro (MPS acceleration — first time I heard the fans sound like a jet)
- **FastAPI** backend — receives image, returns model JSON
- **GPT-4 Turbo** — turns `{type: "sneaker", laces: true}` into a full sentence
- Single HTML frontend, triggered via right-click context menu on images

I was the only developer on the team. Everyone else handled planning, design, and presentation.

## Results

We won **three awards** at the final ceremony — LG Talent, Growth, and Exploration prizes — and I was individually selected for the **US Silicon Valley trip**.

![LG awards](/images/projects/auto-alt/lg-award.png)

![Camp poster](/images/projects/auto-alt/poster.png)

![SNU camp](/images/projects/auto-alt/snu-camp.png)

![Award ceremony](/images/projects/auto-alt/award-ceremony.png)

At Stanford during the US camp, we also prototyped an AI legal advice chatbot for minor traffic violations — different project, same design-thinking energy.

![Stanford certificate](/images/projects/auto-alt/stanford-cert.png)

## More

The full story — application panic, SNU dorm all-nighter, YOLO training on a laptop — is in my [LG AI Youth Camp blog post](/blog/lg-ai-youth-camp). The [US camp writeup](/blog/us-camp) covers Silicon Valley.

![Project overview video](/images/projects/auto-alt/overview.png)
