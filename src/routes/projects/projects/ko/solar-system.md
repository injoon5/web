---
title: '태양계 시뮬레이터'
description: 마음껏 날아다닐 수 있는 Three.js 태양계입니다 — 그럴듯한 스케일, 텍스처, 그리고 각 행성을 따라가는 카메라.
year: '2024'
tags:
  - Three.js
  - JavaScript
  - Vite
published: true
aiTranslated: true
---

## 무엇인가

[solar-sys-sim](https://github.com/injoon5/solar-sys-sim)은 Three.js로 만든 브라우저 기반 태양계다. 행성 여덟 개가 전부 실제 거리(km), 실제 반지름, 그리고 상대적인 공전 속도로 태양을 돈다. 텍스처 입힌 구체, 흰색 공전 타원, 토성한테는 고리 메시까지 붙는다.

[solar-system-ten-dun.vercel.app](https://solar-system-ten-dun.vercel.app)에서 실제로 볼 수 있다.

![Development log](/images/projects/solar-system/dev-log.png)

## 왜 만들었나

한동안 Three.js에 빠져 있었다 — 또 다른 대시보드 말고 뭔가 시각적인 걸 만들고 싶었다. 우주 시뮬레이터는 웹 3D의 hello-world 같은 거긴 한데, 실제 수치랑 NASA 스타일 텍스처로 만들었더니 튜토리얼이라기보단 내가 실제로 열어볼 장난감처럼 느껴졌다.

## 어떻게 동작하나

거의 다 단일 `index.html` 안에 있다 — Vite로 import한 Three.js가 담긴 커다란 인라인 `<script type="module">` 하나다. `main.js`도 있긴 한데 속으면 안 된다. 진짜 시뮬레이터는 전부 HTML 파일 안에 있다.

### 씬 설정

- far clipping plane을 **`1e16`**으로 설정한 `PerspectiveCamera` — 행성 거리가 실제 킬로미터 단위(해왕성은 약 45억 km)라서 꼭 필요하다
- 자유롭게 둘러보려고 `OrbitControls`
- 태양: `Sun.jpg` 텍스처랑 `MeshBasicMaterial`을 입힌 `SphereGeometry(1391400, 64, 64)`

### 행성 데이터

행성마다 배열 안의 객체로, `name`, `size`, `distance`, `texture`, `speed`, `rotationSpeed`, 그리고 `tilt`(축 기울기, 라디안)를 가진다. 눈에 띄는 값들:

- 금성: 음수 `rotationSpeed`(역행 자전), 177° 기울기
- 천왕성: 97.8° 기울기(옆으로 누워 있음)
- 토성: 별도의 `RingGeometry` 자식 메시랑 같이 `hasRings: true`

### 애니메이션 루프

행성은 XZ 평면에서 공전한다:

```javascript
planet.mesh.position.x = Math.cos(angle) * planet.distance;
planet.mesh.position.z = Math.sin(angle) * planet.distance;
```

각도는 `Date.now() * 0.000001 * planet.speed`로 증가한다. 메시마다 매 프레임 Y축으로도 자전한다.

공전 궤도는 `EllipseCurve` → `BufferGeometry` → 흰색 `LineBasicMaterial`로 만들고, 90° 돌려서 평평하게 눕힌다.

### 카메라 추적

행성 버튼을 누르면 `locatePlanet()`이 재귀적인 `requestAnimationFrame` 루프를 돌려서 카메라를 행성 뒤쪽(`distance * 10` 뒤, `size`만큼 위)에 두고 `lookAt`을 호출하면서 `OrbitControls.target`을 갱신한다. **Full View**를 누르면 `stopFollowing` 플래그가 루프를 끊는다.

**Full View**(`backToMainView`)는 카메라를 `(0, 8000000000, 0)`으로 순간이동시켜서 원점을 내려다보게 한다 — 태양계 전체의 조감도다.

오른쪽 정보 패널에는 선택한 행성의 크기, 거리, 공전 속도, 자전 속도가 나온다.

## 스택

Three.js `^0.164.1`, 개발이랑 빌드에는 Vite, 텍스처는 `/public`에 둔다. 백엔드는 아예 없다 — 순수 클라이언트 쪽 WebGL이다.

과학적으로 완벽하진 않지만(기본 줌에서 수성 찾기는 행운을 빈다), 수업 사이사이 이리저리 클릭하면서 놀기엔 충분하다.
