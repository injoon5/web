---
title: 'Pil Text Generator'
description: 짧은 텍스트를 스타일 입힌 PNG 이미지로 바꿔 주는 도구. 디스코드용으로 Pillow랑 FastAPI로 만들었습니다.
year: '2021'
tags:
  - Python
  - FastAPI
  - Pillow
published: true
aiTranslated: true
---

## 무엇인가

[Pil Text Generator](https://github.com/injoon5/pil-discord-txt)(`pil-discord-txt`)는 글자를 받아서 원하는 폰트랑 색으로 PNG를 만들어준다. 원래는 Nitro 안 사고도 디스코드에 좀 꾸민 텍스트를 올리고 싶어서 만들었다.

실제 렌더링은 `textimg.py`가 하고, `main.py`가 그걸 FastAPI 서버로 감싼다.

## 어떻게 동작하나

`gen(text, color, font)`이 그리는 일을 한다:

1. `fontDict`에서 TrueType 폰트를 불러온다. **한글 폰트 10종**(나눔고딕, 롯데마트 드림, Gugi, IBM Plex Sans KR, 서울남산, Spoqa Han Sans Neo 등)
2. `font.getsize()`로 글자 크기를 재고 투명한 RGBA 캔버스를 만든다
3. `ImageDraw.text()`로 그린다. 흰색이나 유색으로 채우고, **3px 외곽선(stroke)**을 두르고, 오른쪽 가운데 기준으로 정렬(`anchor="rm"`)
4. `pil_text.png`로 저장

색은 `colorDict`에 들어있고, 항목마다 `stroke`랑 `color` 튜플이 있다. `original`(디스코드 다크 테마의 회색 위 흰 글씨 stroke), `blurple` / `blurple_old`(디스코드 보라색 두 종류), 그리고 red/green/yellow/blue/pink/grey/white/black이 있다.

## API

FastAPI 앱, 버전 0.1.5:

```
GET /{text}?font=nanum&color=original
```

- 최대 **10자**까지. 더 길면 에러 이미지(`10자 까지만 허용`)를 돌려준다
- 폰트/색 조합이 잘못되면 → `요청이 잘못되었습니다.`
- PNG는 `FileResponse`로 바로 돌려준다
- 단축 라우트 `GET /g/{text}`는 쿼리 파라미터 버전으로 리다이렉트

uvicorn 8080 포트에서 돈다. 관리는 Poetry(`pyproject.toml`)로 한다.

API 호출하는 단출한 HTML 프론트엔드 [dctxt2img-client](https://github.com/injoon5/dctxt2img-client)도 있긴 한데, 솔직히 재밌는 부분은 생성기 쪽이다.

## 왜 Pillow인가

디스코드 메시지는 그냥 평문이다. 매번 Figma 켜지 않고도 커스텀 폰트에 외곽선, 투명 배경까지 들어간, 디자인된 카드 같은 걸 만들고 싶었다. 폰트 파일만 준비되면 Pillow `stroke_width` + `stroke_fill`로 외곽선 효과를 진짜 쉽게 줄 수 있었다.

작은 도구지만 한동안 진짜 자주 썼다. 요즘은 디스코드 자체 서식이 많아졌는데, 그래도 필요하면 API는 아직 돌아간다.
