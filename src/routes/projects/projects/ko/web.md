---
title: 'injoon5.com'
description: 바로 이 사이트입니다 — 블로그, 프로젝트, 댓글, 좋아요, 그리고 Convex 기반 /now 페이지.
year: '2024'
tags:
  - SvelteKit
  - Convex
  - Vercel
published: true
aiTranslated: true
---

## 지금 보고 있는 것

당신은 지금 이 사이트 위에서 이 글을 읽고 있다. [injoon5/web](https://github.com/injoon5/web)은 내 개인 사이트다 — 블로그, 프로젝트 정리, 댓글, 좋아요, 그리고 `/now` 페이지. 가능한 데는 프리렌더, 중요한 데는 실시간으로.

## 프론트엔드

Markdown 콘텐츠에 mdsvex를 쓰는 **SvelteKit**이다. 블로그 글이랑 프로젝트 페이지는 프론트매터 달린 `.md` 파일로 있고, 읽는 시간은 단어 수(영어)나 글자 수(한국어)를 세는 Remark 플러그인이 빌드 타임에 계산한다.

다국어 지원: 블로그 글이랑 프로젝트는 `en/`이랑 `ko/` 디렉터리 양쪽에 있을 수 있다. 슬러그 페이지는 공개된 언어들을 불러와서 알약 모양 토글을 보여준다.

홈페이지는 마운트될 때 클라이언트 쪽에서 외부 JSON 파일 두 개를 가져온다 — [now-playing.json](https://raw.githubusercontent.com/injoon5/data/main/now-playing.json)이랑 같은 저장소의 사진 데이터. 서버는 필요 없다. GitHub raw URL엔 CORS 제한이 없으니까.

## Convex 백엔드

실시간으로 도는 건 전부 Convex를 거친다(클라이언트에선 `convex-svelte` 구독):

| 테이블 | 용도 |
| ----- | ------- |
| `comments` | 페이지 URL별 스레드 댓글, 최대 깊이 2 |
| `commentVotes` | SHA-256 IP 해시를 키로 한 추천/비추천 |
| `likes` | 페이지 단위 좋아요 토글 |
| `bannedIps` | IP 차단 목록 |
| `nowPage` | 편집 가능한 `/now` 페이지 콘텐츠 |

댓글은 **점수**(추천 − 비추천)순으로, 그다음 최신순으로 정렬된다. 비밀번호는 수정/삭제용으로 bcrypt로 해싱한다. 속도 제한은 `@convex-dev/rate-limiter`를 통해 Convex 안에서 돈다 — 콜드 스타트에도 살아남고, HTTP 라우트랑 직접 mutation 양쪽에 적용된다. 유효한 `ADMIN_SECRET`이 담긴 관리자 요청은 전부 우회한다.

관리자 대시보드(`/admin`)는 API 호출에 쿠키 인증 + `x-admin-secret` 헤더를 쓴다. 댓글에 답글 달기, 소프트/하드 삭제, IP 차단, IP 해시 보기를 할 수 있다.

## API 계층

SvelteKit API 라우트(`/api/comments`, `/api/likes`, `/api/admin/*`)는 브라우저랑 Convex 사이에 끼어서 화려하지 않은 중간 계층 일을 한다: IP 해싱, Zod 검증, bcrypt 확인, 그리고 Convex 에러를 적절한 HTTP 상태 코드로 옮기는 일(속도 제한에 걸리면 `Retry-After` 붙은 429).

## OG 이미지

`/api/og`에 OG 생성이 내장돼 있다 — `src/lib/og/templates.js`의 satori 템플릿으로, 1200×630 크기에 어두운 점격자 배경을 깐다. 블로그 글, 프로젝트, 목록 페이지마다 레이아웃이 따로 있다.

## 왜 자꾸 다시 만드나

이건 버전… 여러 번째다. Raster, 여러 번의 Next.js, Ghost 테마, 그리고 oij-web 시절 전부까지. 댓글을 SQL + Redis에서 옮긴 건, 인프라를 관리하지 않으면서도 Convex 실시간 구독을 쓰고 싶었기 때문이다.

이건 절대 끝나지 않는다. 근데 내 거고, 바로 그게 핵심이다.
