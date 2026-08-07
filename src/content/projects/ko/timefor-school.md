---
title: 'TimeforSchool'
description: 우리 반을 위해 만든 학교 도구 모음. NEIS API 백엔드, 실시간 공지 게시판, MCP 서버입니다.
year: '2025'
tags:
  - SvelteKit
  - Convex
  - Python
  - FastAPI
  - MCP
published: true
aiTranslated: true
---

## 아이디어

학교생활은 결국 몇 가지 질문이 계속 도는 거다. 내일 뭐 마감이지, 오늘 급식 뭐지, 화요일 3교시 뭐지. 우리 반은 이걸 다 카톡으로 해결했는데, 메시지가 묻히고 누가 같은 걸 다섯 번째로 물어보기 시작하면 슬슬 한계가 온다.

**TimeforSchool**은 그 문제 주변으로 만든 도구 묶음이다. 브랜드([timefor.school](https://timefor.school))는 하나, 저장소는 셋.

## Class Info

[class-info](https://github.com/injoon5/class-info)는 우리 반 공지 게시판이다. 애들이 실제로 폰으로 여는 게 이거다.

### 공지

Convex `notices` 테이블엔 제목, 과목, 유형(`수행평가` / `숙제` / `준비물` / `기타`), Markdown 설명, 마감일, 그리고 첨부 파일(있으면 R2에 저장)이 들어간다. 공지마다 공유용 상세 URL 만들라고 랜덤 5글자 슬러그가 붙는다.

메인 페이지에선 Markdown을 통째로 뿌리지 않는다. `summarizeDescription()`이 첫 줄만 떼서 앞에 붙은 `#` 헤더를 지우고, `![alt](url)` 이미지 문법은 alt 텍스트(없으면 파일명)로 바꾼다. 폰에서 목록이 한눈에 들어오게 하려고.

학교 특화된 건 묶는 방식이다. **KST 16:00 컷오프**가 있어서, 오후 4시 넘어가면 마감일 정렬에서 "오늘"이 사실상 내일이 된다. 공지는 `오늘`, `내일`, 아니면 `M/D (요일)`로 뜨고, 지난 공지는 월별(`2025년 3월` 이런 식)로 묶인다.

관리자 화면은 PIN으로 막아놨다. Convex 구독으로 실시간 동기화돼서, 관리자에서 올리면 다들 바로 본다.

### 시간표, 급식, 학사 일정

Class Info엔 공지만 있는 게 아니다. 같은 Convex 백엔드가 시간표, 급식, 학사 일정 데이터를 각각 다른 테이블(`timetables`, `meals`, `schedules`)에 캐싱한다. cron이 한 시간마다 갱신해준다:

- 이번 주 + 다음 주 시간표 (내부 `timetable.fetchAndSave`로)
- 이번 주 + 다음 주 급식
- 매일 03:00 UTC에 학사 일정 구간

이렇게 해두면 페이지 열 때마다 API를 두드리지 않고도 급식이랑 일정을 바로 띄울 수 있다.

스택: SvelteKit 5, Convex, Tailwind v4, Turborepo 모노레포(`apps/web` + `packages/backend`).

## School API

[school-api](https://github.com/injoon5/school-api)는 FastAPI 백엔드다. OpenAPI 문서에선 **SchoolKit**이라고 불렀다.

데이터 소스가 두 갠데, 이거 알아내는 데 한참 걸렸다:

1. **시간표**: `timetable_api.py`로 [comci.net](http://comci.net)에서 긁어온다. `TimeTable` 클래스가 거기 JS API를 역으로 까보는 건데, 페이지에서 세션 코드를 정규식으로 뽑고, 학교/주차 파라미터를 base64로 인코딩한 다음, `[학년][반][요일][교시]`로 중첩된 구조를 만든다. **보강 수업**도 잡아내는데, `replaced: true`면 응답에 원래 과목이랑 교사가 같이 들어온다.

2. **급식 + 학사 일정 + 학교 조회**: `neispy`로 NEIS 오픈 API를 쓴다. 급식 메뉴는 괄호 안 알레르기 표시를 떼고, 읽기 편하게 공백을 줄바꿈으로 바꾼다.

엔드포인트:

| 라우트           | 하는 일                                  |
| ---------------- | ---------------------------------------- |
| `GET /timetable` | 학년, 반, 주차(0/1), 학교 코드 또는 이름 |
| `GET /lunch`     | `startdate` / `enddate`를 `YYYYMMDD`로   |
| `GET /schedule`  | 기간 내 학사 일정 행사                   |
| `GET /school`    | 학교 이름으로 조회                       |
| `GET /classes`   | 한 학년의 반 번호들                      |

CORS는 `timetable.injoon5.com`이랑 localhost만 열어놨다. [api.timefor.school](https://api.timefor.school)에 있다.

## TimeforSchool MCP

API가 안정되고 나니까, 브라우저 안 열고 그냥 Claude한테 "이번 주 급식 뭐야" 물어보고 싶어졌다. [timeforschool-mcp](https://github.com/injoon5/timeforschool-mcp)는 [xmcp](https://xmcp.dev)로 같은 엔드포인트를 MCP 도구로 감싼 거다:

- **`timetable`**: Zod로 검증하는 파라미터(`grade`, `classno`, `week`, `schoolcode`는 기본값 `7081492`). 읽기 전용에 멱등.
- **`lunch`**: 날짜 범위 + 학교 코드. 어노테이션은 똑같다.

HTTP 전송은 [timeforschool-mcp.vercel.app](https://timeforschool-mcp.vercel.app)에 있고, 로컬에서 쓰라고 stdio 빌드도 있다.

이걸 매일 쓰게 될지 그냥 멋있는 데모로 끝날지는 아직 모르겠다. 두고 봐야지.

## 저장소

| 구성 요소                 | GitHub                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| 공지 게시판 + 캐시 데이터 | [injoon5/class-info](https://github.com/injoon5/class-info)               |
| NEIS + comci API          | [injoon5/school-api](https://github.com/injoon5/school-api)               |
| MCP 서버                  | [injoon5/timeforschool-mcp](https://github.com/injoon5/timeforschool-mcp) |
