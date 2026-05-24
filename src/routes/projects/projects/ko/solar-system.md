---
title: '태양계 시뮬레이터'
description: 마음껏 날아다닐 수 있는 Three.js 태양계. 그럴듯한 스케일이랑 텍스처, 행성을 따라가는 카메라까지 있습니다.
year: '2024'
tags:
  - Three.js
  - JavaScript
  - Vite
published: true
aiTranslated: true
---

## 무엇인가

[solar-sys-sim](https://github.com/injoon5/solar-sys-sim)은 Three.js로 만든 브라우저 태양계다. 행성 여덟 개가 전부 실제 거리(km)랑 실제 반지름, 상대적인 공전 속도로 태양을 돈다. 텍스처 입힌 구체에, 흰색 공전 궤도, 토성엔 고리 메시까지 붙어있다.

실제로 [solar-system-ten-dun.vercel.app](https://solar-system-ten-dun.vercel.app)에서 볼 수 있다.

![Development log](/images/projects/solar-system/dev-log.png)

## 왜 만들었나

한동안 Three.js에 빠져 있었는데, 또 대시보드 같은 거 말고 뭔가 시각적인 걸 만들고 싶었다. 우주 시뮬레이터야 웹 3D의 hello-world 같은 거지만, 실제 수치랑 NASA 스타일 텍스처로 만드니까 튜토리얼보다는 내가 진짜 열어보고 싶은 장난감에 가까워졌다.

## 어떻게 동작하나

거의 다 `index.html` 하나에 들어있다. Vite로 Three.js를 import한 커다란 인라인 `<script type="module">` 하나다. `main.js`도 있긴 한데 거기 속으면 안 된다. 진짜 알맹이는 전부 HTML 파일 안에 있다.

### 씬 설정

- `PerspectiveCamera`. far clipping plane을 **`1e16`**으로 잡았는데, 행성 거리가 실제 km 단위라 그렇다(해왕성이 약 45억 km)
- 자유롭게 둘러보라고 `OrbitControls`
- 태양은 `Sun.jpg` 텍스처에 `MeshBasicMaterial` 입힌 `SphereGeometry(1391400, 64, 64)`

### 행성 데이터

행성은 각각 배열 안의 객체로, `name`, `size`, `distance`, `texture`, `speed`, `rotationSpeed`, `tilt`(축 기울기, 라디안)를 가진다. 눈에 띄는 것들:

- 금성: `rotationSpeed`가 음수(역행 자전)에, 기울기 177°
- 천왕성: 기울기 97.8°(거의 옆으로 누워있음)
- 토성: `hasRings: true`라서 `RingGeometry` 자식 메시가 따로 붙는다

### 애니메이션 루프

행성은 XZ 평면 위에서 돈다:

```javascript
planet.mesh.position.x = Math.cos(angle) * planet.distance;
planet.mesh.position.z = Math.sin(angle) * planet.distance;
```

각도는 `Date.now() * 0.000001 * planet.speed`로 점점 커진다. 메시는 매 프레임 Y축으로도 자전한다.

공전 궤도는 `EllipseCurve`를 `BufferGeometry`로 바꾸고 흰색 `LineBasicMaterial`을 입힌 다음, 90° 돌려서 바닥에 눕혔다.

### 카메라 추적

행성 버튼을 누르면 `locatePlanet()`이 `requestAnimationFrame` 루프를 재귀로 돌리면서 카메라를 행성 뒤쪽(`distance * 10`만큼 뒤, `size`만큼 위)에 가져다 놓고, `lookAt` 호출하면서 `OrbitControls.target`도 같이 갱신한다. **Full View**를 누르면 `stopFollowing` 플래그가 이 루프를 끊는다.

**Full View**(`backToMainView`)는 카메라를 `(0, 8000000000, 0)`으로 확 옮겨서 원점을 내려다보게 한다. 태양계 전체를 위에서 보는 셈이다.

오른쪽 정보 패널엔 선택한 행성의 크기, 거리, 공전 속도, 자전 속도가 뜬다.

## 스택

Three.js `^0.164.1`, 개발이랑 빌드는 Vite, 텍스처는 `/public`에 둔다. 백엔드는 아예 없다. 그냥 클라이언트에서 도는 WebGL이다.

과학적으로 완벽하진 않지만(기본 줌에선 수성 찾기 힘들다) 수업 사이에 이리저리 클릭하면서 놀기엔 충분하다.
