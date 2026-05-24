---
title: '태양계 시뮬레이터'
description: 마음껏 날아다닐 수 있는 Three.js 태양계 — 그럴듯한 스케일, 텍스처, 그리고 각 행성을 따라가는 카메라.
year: '2024'
tags:
  - Three.js
  - JavaScript
  - Vite
published: true
aiTranslated: true
---

## 무엇인가

[solar-sys-sim](https://github.com/injoon5/solar-sys-sim)은 Three.js로 만든 브라우저 기반 태양계입니다. 여덟 개 행성 모두가 실제 거리(km), 실제 반지름, 그리고 상대적인 공전 속도로 태양을 공전합니다. 텍스처를 입힌 구체, 흰색 공전 타원, 토성에는 고리 메시까지 붙습니다.

[solar-system-ten-dun.vercel.app](https://solar-system-ten-dun.vercel.app)에서 실제로 볼 수 있습니다.

![Development log](/images/projects/solar-system/dev-log.png)

## 왜 만들었나

한동안 Three.js에 빠져 있었습니다 — 또 다른 대시보드 말고, 뭔가 시각적인 걸 만들고 싶었죠. 우주 시뮬레이터는 웹 3D의 hello-world 같은 거지만, 실제 수치와 NASA 스타일 텍스처로 만들었더니 튜토리얼이라기보다 제가 실제로 열어 보고 싶은 장난감처럼 느껴졌습니다.

## 어떻게 동작하나

거의 모든 게 단일 `index.html` 안에 있습니다 — Vite로 import한 Three.js가 담긴 커다란 인라인 `<script type="module">` 하나죠. `main.js`도 있지만 속지 마세요: 진짜 시뮬레이터는 전부 HTML 파일 안에 있습니다.

### 씬 설정

- far clipping plane을 **`1e16`**으로 설정한 `PerspectiveCamera` — 행성 거리가 실제 킬로미터 단위(해왕성은 약 45억 km)라서 꼭 필요합니다
- 자유로운 시점 이동을 위한 `OrbitControls`
- 태양: `Sun.jpg` 텍스처와 `MeshBasicMaterial`을 입힌 `SphereGeometry(1391400, 64, 64)`

### 행성 데이터

각 행성은 배열 안의 객체로, `name`, `size`, `distance`, `texture`, `speed`, `rotationSpeed`, 그리고 `tilt`(축 기울기, 라디안)를 가집니다. 눈에 띄는 값들:

- 금성: 음수 `rotationSpeed`(역행 자전), 177° 기울기
- 천왕성: 97.8° 기울기(옆으로 누운 상태)
- 토성: 별도의 `RingGeometry` 자식 메시와 함께 `hasRings: true`

### 애니메이션 루프

행성은 XZ 평면에서 공전합니다:

```javascript
planet.mesh.position.x = Math.cos(angle) * planet.distance;
planet.mesh.position.z = Math.sin(angle) * planet.distance;
```

각도는 `Date.now() * 0.000001 * planet.speed`로 증가합니다. 각 메시는 매 프레임 Y축으로도 자전합니다.

공전 궤도는 `EllipseCurve` → `BufferGeometry` → 흰색 `LineBasicMaterial`로 만들고, 90° 회전시켜 평평하게 눕힙니다.

### 카메라 추적

행성 버튼을 누르면 `locatePlanet()`이 재귀적인 `requestAnimationFrame` 루프를 시작해 카메라를 행성 뒤쪽(`distance * 10` 뒤, `size`만큼 위)에 두고 `lookAt`을 호출하며 `OrbitControls.target`을 갱신합니다. **Full View**를 누르면 `stopFollowing` 플래그가 루프를 끊습니다.

**Full View**(`backToMainView`)는 카메라를 `(0, 8000000000, 0)`으로 순간이동시켜 원점을 내려다보게 합니다 — 태양계 전체의 조감도죠.

오른쪽 정보 패널에는 선택한 행성의 크기, 거리, 공전 속도, 자전 속도가 표시됩니다.

## 스택

Three.js `^0.164.1`, 개발과 빌드에는 Vite, 텍스처는 `/public`에 둡니다. 백엔드는 전혀 없습니다 — 순수 클라이언트 사이드 WebGL입니다.

과학적으로 완벽하진 않지만(기본 줌에서 수성 찾기는 행운을 빕니다), 수업 사이사이 이리저리 클릭하며 놀기엔 충분합니다.
