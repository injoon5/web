---
title: 'Pil Text Generator'
description: 짧은 텍스트를 스타일이 적용된 PNG 이미지로 — 디스코드를 위해, Pillow와 FastAPI로 제작.
year: '2021'
tags:
  - Python
  - FastAPI
  - Pillow
published: true
aiTranslated: true
---

## 무엇인가

[Pil Text Generator](https://github.com/injoon5/pil-discord-txt)(`pil-discord-txt`)는 문자열을 받아 원하는 폰트와 색으로 PNG로 렌더링합니다. 원래는 Nitro 서식에 돈을 쓰지 않고도 디스코드에 스타일이 들어간 텍스트를 올리려고 만들었습니다.

핵심 렌더링 로직은 `textimg.py`에 있고, `main.py`가 그걸 FastAPI 서버로 감쌉니다.

## 어떻게 동작하나

`gen(text, color, font)`이 렌더링을 담당합니다:

1. `fontDict`에서 TrueType 폰트 로드 — **한글 폰트 10종**(나눔고딕, 롯데마트 드림, Gugi, IBM Plex Sans KR, 서울남산, Spoqa Han Sans Neo 등)
2. `font.getsize()`로 텍스트 크기를 측정하고 투명 RGBA 캔버스 생성
3. `ImageDraw.text()`로 그리기 — 흰색/유색 채움, **3px 외곽선(stroke)**, 오른쪽-가운데 정렬(`anchor="rm"`)
4. `pil_text.png`로 저장

색은 `colorDict`에 있고, 각 항목은 `stroke`와 `color` 튜플을 가집니다. 옵션으로는 `original`(디스코드 다크 테마의 회색 위 흰색 stroke), `blurple` / `blurple_old`(디스코드의 두 가지 보라색), 그리고 red/green/yellow/blue/pink/grey/white/black이 있습니다.

## API

FastAPI 앱, 버전 0.1.5:

```
GET /{text}?font=nanum&color=original
```

- 최대 **10자** — 더 길면 에러 이미지 반환(`10자 까지만 허용`)
- 잘못된 폰트/색 조합 → `요청이 잘못되었습니다.`
- `FileResponse`로 PNG를 바로 반환
- 단축 라우트 `GET /g/{text}`는 쿼리 파라미터 버전으로 리다이렉트

uvicorn 8080 포트에서 실행됩니다. Poetry(`pyproject.toml`)로 관리합니다.

API를 호출하는 단출한 HTML 프런트엔드 [dctxt2img-client](https://github.com/injoon5/dctxt2img-client)도 있지만, 솔직히 흥미로운 부분은 생성기 그 자체입니다.

## 왜 Pillow인가

디스코드 메시지는 평문입니다. 저는 Figma를 매번 열지 않고도 — 커스텀 폰트, 외곽선, 투명 배경이 들어간 — 디자인된 카드처럼 보이는 무언가를 원했습니다. 폰트 파일만 갖춰지면 Pillow의 `stroke_width` + `stroke_fill` 파라미터가 외곽선 텍스트 효과를 손쉽게 만들어 줬습니다.

작은 도구지만 한동안 정말 자주 썼습니다. 요즘은 디스코드에 네이티브 서식이 더 많아졌지만, 필요하다면 API는 여전히 돌아갑니다.
