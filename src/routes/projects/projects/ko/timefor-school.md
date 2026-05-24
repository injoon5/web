---
title: 'TimeforSchool'
description: 우리 반을 위한 학교 도구 모음입니다 — NEIS API 백엔드, 실시간 공지 게시판, 그리고 MCP 서버.
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

학교생활은 몇 가지 반복되는 질문으로 돌아간다: 내일 뭐가 마감이지, 오늘 급식 뭐지, 화요일 3교시 뭐지. 우리 반은 이 전부를 카카오톡으로 해결하곤 했는데 — 메시지가 묻히고 누가 같은 걸 다섯 번째로 물어보기 전까지는 그럭저럭 굴러간다.

**TimeforSchool**은 그 문제를 중심으로 내가 만든 도구 묶음이다. 같은 브랜드([timefor.school](https://timefor.school)), 저장소 셋, 하나의 생태계.

## Class Info

[class-info](https://github.com/injoon5/class-info)는 우리 반 공지 게시판이다 — 사람들이 실제로 폰에서 여는 그거.

### 공지

Convex `notices` 테이블은 제목, 과목, 유형(`수행평가` / `숙제` / `준비물` / `기타`), Markdown 설명, 마감일, 그리고 선택적 첨부 파일(R2에 저장)을 담는다. 공지마다 공유 가능한 상세 URL용으로 임의의 5글자 슬러그가 붙는다.

메인 페이지는 Markdown 전체를 쏟아내지 않는다. `summarizeDescription()`이 첫 줄을 가져와서 앞쪽 `#` 헤더를 떼고, `![alt](url)` 이미지 문법을 대체 텍스트(아니면 파일명)로 바꾼다. 폰에서 목록이 한눈에 들어오게 유지하는 거다.

학교에 특화된 부분은 그룹핑이다. **KST 16:00 컷오프**가 있어서 — 오후 4시 이후엔 마감일 정렬에서 "오늘"이 사실상 내일이 된다. 공지는 `오늘`, `내일`, 아니면 `M/D (요일)`로 표시된다. 지난 공지는 월별 묶음(`2025년 3월` 등)으로 들어간다.

관리자 화면은 PIN으로 보호된다. Convex 구독을 통한 실시간 동기화 — 관리자에서 올리면 모두가 바로 본다.

### 시간표, 급식, 학사 일정

Class Info는 공지만 있는 게 아니다. 같은 Convex 백엔드가 시간표, 급식 메뉴, 학사 일정 데이터를 별도 테이블(`timetables`, `meals`, `schedules`)에 캐시한다. cron 작업이 매시간 갱신한다:

- 이번 주 + 다음 주 시간표 (내부 `timetable.fetchAndSave` 경유)
- 이번 주 + 다음 주 급식
- 매일 03:00 UTC에 학사 일정 구간

그러면 웹사이트가 페이지 열 때마다 API를 두들기지 않고도 급식이랑 일정을 바로 보여줄 수 있다.

스택: SvelteKit 5, Convex, Tailwind v4, Turborepo 모노레포(`apps/web` + `packages/backend`).

## School API

[school-api](https://github.com/injoon5/school-api)는 FastAPI 백엔드다. OpenAPI 문서에선 **SchoolKit**이라고 불렀다.

데이터 소스가 두 갠데, 알아내는 데 한참 걸렸다:

1. **시간표** — `timetable_api.py`로 [comci.net](http://comci.net)에서 스크래핑한다. `TimeTable` 클래스가 걔네 JS API를 역설계하는데: 페이지에서 세션 코드를 정규식으로 파싱하고, 학교/주차 파라미터를 base64로 인코딩한 뒤, 중첩된 `[학년][반][요일][교시]` 구조를 만든다. **보강 수업**도 추적해서 — `replaced: true`일 때 응답에 원래 과목/교사가 들어간다.

2. **급식 + 학사 일정 + 학교 조회** — `neispy`를 통한 NEIS 오픈 API. 급식 메뉴명은 괄호 안 알레르기 태그가 빠지고, 가독성을 위해 공백이 줄바꿈으로 바뀐다.

엔드포인트:

| 라우트 | 하는 일 |
| ----- | ------------ |
| `GET /timetable` | 학년, 반, 주차(0/1), 학교 코드 또는 이름 |
| `GET /lunch` | `startdate` / `enddate`를 `YYYYMMDD`로 |
| `GET /schedule` | 기간 내 학사 일정 행사 |
| `GET /school` | 학교 이름으로 조회 |
| `GET /classes` | 한 학년의 반 번호들 |

CORS는 `timetable.injoon5.com`이랑 localhost로 잠가놨다. [api.timefor.school](https://api.timefor.school)에 있다.

## TimeforSchool MCP

API가 안정되고 나니까, 브라우저 안 열고 Claude한테 "이번 주 급식 뭐야"라고 묻고 싶어졌다. [timeforschool-mcp](https://github.com/injoon5/timeforschool-mcp)는 [xmcp](https://xmcp.dev)를 통해 같은 엔드포인트를 MCP 도구로 감싼다:

- **`timetable`** — Zod로 검증되는 파라미터(`grade`, `classno`, `week`, 그리고 `7081492`를 기본값으로 하는 `schoolcode`). 읽기 전용, 멱등.
- **`lunch`** — 날짜 범위 + 학교 코드. 어노테이션은 같다.

HTTP 전송은 [timeforschool-mcp.vercel.app](https://timeforschool-mcp.vercel.app)에 있고, 로컬 클라이언트용 stdio 빌드도 있다.

이걸 매일 쓰게 될지, 아니면 그냥 멋진 데모로 끝날지는 아직 실험 중이다. 판단은 보류.

## 저장소

| 구성 요소 | GitHub |
| ----- | ------ |
| 공지 게시판 + 캐시 데이터 | [injoon5/class-info](https://github.com/injoon5/class-info) |
| NEIS + comci API | [injoon5/school-api](https://github.com/injoon5/school-api) |
| MCP 서버 | [injoon5/timeforschool-mcp](https://github.com/injoon5/timeforschool-mcp) |
