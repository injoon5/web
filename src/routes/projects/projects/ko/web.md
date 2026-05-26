---
title: 'injoon5.com'
description: 바로 이 사이트입니다. 블로그, 프로젝트, 댓글, 좋아요, 그리고 Convex 기반 /now 페이지.
year: '2024'
tags:
  - SvelteKit
  - Convex
  - Vercel
published: true
aiTranslated: true
---

## 지금 보고 있는 것

지금 이거 보고 있는 게 그거다. [injoon5/web](https://github.com/injoon5/web)은 내 개인 사이트다. 블로그, 프로젝트 정리, 댓글, 좋아요, `/now` 페이지. 정적으로 만들 수 있는 건 프리렌더하고, 실시간이 필요한 데만 실시간으로 돌린다.

## 프론트엔드

**SvelteKit**에 Markdown은 mdsvex로 처리한다. 블로그 글이랑 프로젝트 페이지는 프론트매터 달린 `.md` 파일이고, 읽는 시간은 Remark 플러그인이 빌드할 때 단어 수(영어)나 글자 수(한국어)를 세서 계산한다.

다국어도 된다. 블로그랑 프로젝트는 `en/`이랑 `ko/` 폴더에 둘 다 있을 수 있고, 슬러그 페이지가 공개된 언어만 불러와서 알약 모양 토글을 띄운다.

홈페이지 **Now Listening**이랑 **Photos** 위젯은 Convex `homeFeedCache`에서 읽는다. 크론이 Last.fm(`LAST_FM_PUBLIC_API_KEY`, 1분마다)이랑 [photos.injoon5.com/feed.json](https://photos.injoon5.com/feed.json)(1시간마다)을 직접 가져온다. 예전 [injoon5/data](https://github.com/injoon5/data) 저장소는 읽기 경로에 없다.

## Convex 백엔드

실시간으로 도는 건 다 Convex를 거친다(클라이언트는 `convex-svelte` 구독):

| 테이블 | 용도 |
| ----- | ------- |
| `comments` | 페이지 URL별 스레드 댓글, 최대 깊이 2 |
| `commentVotes` | SHA-256 IP 해시를 키로 한 추천/비추천 |
| `likes` | 페이지 단위 좋아요 토글 |
| `bannedIps` | IP 차단 목록 |
| `nowPage` | 편집 가능한 `/now` 페이지 콘텐츠 |

댓글은 **점수**(추천 − 비추천) 순으로 정렬하고, 같으면 최신순이다. 비밀번호는 수정/삭제용으로 bcrypt 해싱한다. 속도 제한은 `@convex-dev/rate-limiter`로 Convex 안에서 도는데, 콜드 스타트에도 안 풀리고 HTTP 라우트랑 직접 mutation 양쪽에 다 걸린다. `ADMIN_SECRET`이 맞는 관리자 요청은 이 전부를 건너뛴다.

관리자 대시보드(`/admin`)는 쿠키 인증이랑 `x-admin-secret` 헤더로 API를 부른다. 댓글 답글, 소프트/하드 삭제, IP 차단, IP 해시 보기 같은 걸 할 수 있다.

## API 계층

SvelteKit API 라우트(`/api/comments`, `/api/likes`, `/api/admin/*`)가 브라우저랑 Convex 사이에 끼어서 별로 화려하진 않은 중간 일을 한다. IP 해싱, Zod 검증, bcrypt 확인, 그리고 Convex 에러를 알맞은 HTTP 상태 코드로 바꿔주는 거(속도 제한 걸리면 `Retry-After` 붙은 429).

## OG 이미지

`/api/og`에 OG 이미지 생성이 들어있다. `src/lib/og/templates.js`의 satori 템플릿으로 1200×630에 어두운 점격자 배경. 블로그, 프로젝트, 목록 페이지마다 레이아웃이 따로 있다.

## 왜 자꾸 다시 만드나

이게 벌써 몇 번째 버전인지 모르겠다. Raster, Next.js로 몇 번, Ghost 테마, oij-web 시절까지 다 거쳤다. 댓글을 SQL + Redis에서 옮긴 건 인프라 관리 안 하면서 Convex 실시간 구독을 쓰고 싶어서였다.

이건 영영 안 끝난다. 근데 내 거니까, 그게 핵심이다.
