---
title: 'Solar System Simulator'
description: A Three.js solar system you can fly around — real-ish scale, textures, and a camera that follows each planet.
year: '2024'
tags:
  - Three.js
  - JavaScript
  - Vite
published: true
---

## What it is

[solar-sys-sim](https://github.com/injoon5/solar-sys-sim) is a browser-based solar system built with Three.js. All eight planets orbit the sun with (roughly) correct relative sizes, distances, and orbital speeds. Textured spheres, orbit paths drawn in white, Saturn gets rings.

Live at [solar-system-ten-dun.vercel.app](https://solar-system-ten-dun.vercel.app).

## Why I built it

I'd been going through a Three.js phase — wanted something visual that wasn't another dashboard. Space sims are the hello-world of 3D on the web, but doing it with real numbers (kilometers, not arbitrary units) and actual NASA-style textures made it feel less like a tutorial and more like a toy I'd actually open.

## How it works

The scene is one HTML file plus Vite. `OrbitControls` for free look-around; buttons along the top jump the camera to follow a specific planet (Mercury through Neptune). Click a planet and an info panel shows size, distance from the sun, orbital speed, rotation speed — the numbers come straight from the planet data array.

Planets move on circular orbits in the XZ plane; each mesh rotates on its axis at its own rate. Venus spins backward. Uranus is tilted on its side. The sun is a textured sphere at the center, scaled to ~1.39 million km radius like everything else.

**Full View** pulls the camera back above the whole system so you can see the layout again.

## Stack

Three.js, Vite, textures served as static images (`Sun.jpg`, `Earth.jpg`, etc.). No backend — pure client-side WebGL.

It's not scientifically perfect (distances are real but good luck seeing inner planets from the default zoom), but for clicking around between classes it does the job.
