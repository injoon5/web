---
title: 'Galaga Clone'
description: A pygame Galaga-style shooter I built in middle school — enemies, rainbow missiles, and a rickroll restart button.
year: '2020'
tags:
  - Python
  - pygame
published: true
---

## What it is

[galaga-clone](https://github.com/injoon5/galaga-clone) is a Galaga-style vertical shooter I wrote in Python with pygame. One file (`galaga.py`), ~200 lines, sprite PNGs, and a BGM track bundled in. I was learning game dev at my coding academy (C3 Coding) and this was the capstone-ish project.

There's also a `beta/main.py` with restart logic tweaks, and a `tutorials/` folder full of smaller pygame exercises — mouse tracking, font rendering, BGM playback — that I worked through along the way.

## How it plays

640×650 window, 60 FPS. You control a ship at the bottom (`forces.png`), move with **left/right arrow keys** (3 px per frame, clamped to screen bounds), shoot with **space**.

Enemies (`enemy.png`) spawn every **1 second** from random X positions above the screen. Each `Enermy` (yes, that's how I spelled it in the code) picks a random fall speed (2–6) and horizontal direction, then **accelerates downward** (`dy += 0.1` every frame). They bounce off the left/right walls by flipping `dx`.

Missiles are not sprites — they're **6 px wide lines** drawn with `pygame.draw.line`, and each one gets a **random RGB color** every frame. Very 2020 energy.

Hit an enemy → +1 score, both objects deleted. Enemy reaches your ship → game over overlay (`game-over.png`), restart button appears. Click restart and you're back in.

## Code structure

Four classes in one loop:

| Class | Job |
| ----- | --- |
| `Enermy` | Spawn, move, bounce, collide with missiles |
| `Forces` | Player ship — move, draw, fire, collision with enemies |
| `Missile` | Fly upward at 5 px/frame, delete when off screen |
| `Button` | Hit-test for the restart image |

Collision is manual — nested `while` loops deleting from lists with index decrements. No pygame sprites groups, no physics engine. Just rects and `collidepoint`.

The game-over state sets `gaming = False`, clears enemies, resets score to 0, and waits for a mouse click on the restart button rect at `(250, 510)`.

## Assets

- `enemy.png`, `forces.png` — ship sprites with black colorkey
- `game-over.png`, `restart.png` — end screen UI
- `Forget Me Not - Patrick Patrikios.mp3` — background music (tutorial folder has the pygame BGM loading code)

## Honest take

It's janky by today's standards — typos in class names, list mutation in while loops, score resets on game over before you even click restart. But it was the first game I finished end-to-end, and I still remember the satisfaction of getting enemy bounce physics working. The README just says `c3coding pygame` and points to a sequel in `codingPro01/galaga` that never really went anywhere.
