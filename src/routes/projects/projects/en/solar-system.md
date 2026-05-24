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

[solar-sys-sim](https://github.com/injoon5/solar-sys-sim) is a browser-based solar system built with Three.js. All eight planets orbit the sun with real distances (in km), real radii, and relative orbital speeds. Textured spheres, white orbit ellipses, Saturn gets a ring mesh.

Live at [solar-system-ten-dun.vercel.app](https://solar-system-ten-dun.vercel.app).

## Why I built it

I'd been going through a Three.js phase — wanted something visual that wasn't another dashboard. Space sims are the hello-world of 3D on the web, but doing it with actual numbers and NASA-style textures made it feel less like a tutorial and more like a toy I'd actually open.

## How it works

Almost everything lives in a single `index.html` — inline `<script type="module">` with Three.js imported via Vite. `main.js` exists but the real sim is in the HTML file.

### Scene setup

- `PerspectiveCamera` with far clipping plane set to **`1e16`** — necessary because planet distances are in actual kilometers (Neptune at ~4.5 billion km)
- `OrbitControls` for free look-around
- Sun: `SphereGeometry(1391400, 64, 64)` with a `Sun.jpg` texture, `MeshBasicMaterial`

### Planet data

Each planet is an object in an array with `name`, `size`, `distance`, `texture`, `speed`, `rotationSpeed`, and `tilt` (axis inclination in radians). Notable values:

- Venus: negative `rotationSpeed` (retrograde spin), 177° tilt
- Uranus: 97.8° tilt (on its side)
- Saturn: `hasRings: true` with a separate `RingGeometry` child mesh

### Animation loop

Planets orbit on the XZ plane:

```javascript
planet.mesh.position.x = Math.cos(angle) * planet.distance;
planet.mesh.position.z = Math.sin(angle) * planet.distance;
```

Angle advances via `Date.now() * 0.000001 * planet.speed`. Each mesh also rotates on its Y axis every frame.

Orbit paths are `EllipseCurve` → `BufferGeometry` → white `LineBasicMaterial`, rotated 90° to lie flat.

### Camera follow

Click a planet button and `locatePlanet()` starts a recursive `requestAnimationFrame` loop that positions the camera behind the planet (`distance * 10` back, `size` up) and calls `lookAt` + updates `OrbitControls.target`. A `stopFollowing` flag breaks the loop when you hit **Full View**.

**Full View** (`backToMainView`) teleports the camera to `(0, 8000000000, 0)` looking down at the origin — bird's-eye of the whole system.

An info panel on the right shows size, distance, orbital speed, and rotation speed for the selected planet.

## Stack

Three.js `^0.164.1`, Vite for dev/build, textures in `/public`. No backend — pure client-side WebGL.

It's not scientifically perfect (good luck spotting Mercury from the default zoom), but for clicking around between classes it does the job.
