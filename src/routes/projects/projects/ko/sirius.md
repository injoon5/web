---
title: 'Sirius 앱'
description: 시간표, 공지, 학급 정보를 한곳에 모은 학교 대시보드 앱입니다. 영재교육원에서 시작했습니다.
year: '2022'
tags:
  - Swift
  - Python
  - Next.js
published: true
aiTranslated: true
---

## 무엇이었나

**Sirius**(`학교 정보를 한눈에`)는 [영재교육원](https://github.com/injoon5/sirius-web)에서 만든 학교생활 앱이었다. 아이디어는 이랬다: 서로 다른 앱 세 개랑 카카오톡 단톡방을 번갈아 보는 대신, 시간표랑 공지, 그리고 쉬는 시간에 필요한 그 밖의 것들을 한곳에 모으자는 것.

원래 목표는 학교 데이터를 스크래핑/처리하는 **Python** 백엔드를 갖춘 네이티브 **Swift** 앱이었다. GitHub에 올라와 있는 건 웹 프로토타입이다: [sirius-web](https://github.com/injoon5/sirius-web), Next.js + Tailwind 대시보드.

## 웹 프로토타입

StackBlitz에서 만들어서 GitHub으로 내보냈다. 홈페이지는 그리드 레이아웃이 가질 수 있는 가장 단순한 형태에 가깝다:

- 헤더: **Sirius** + 태그라인
- 프로필 카드 (아바타, 이름, 학교 — 데모에선 이대부속초등학교로 하드코딩)
- 번호 매긴 타일 3×3 그리드(`01`–`09`) — 시간표, 급식, 숙제 등을 위한 자리 표시자

설정이랑 로그아웃 링크는… 릭롤이다. (`youtube.com/watch?v=dQw4w9WgXcQ`.) 그때 나 13살이었다 ㅋㅋ

스택: Next.js pages 라우터, Tailwind CSS, 공개 저장소엔 백엔드가 연결돼 있지 않다. 이 단계에선 기능하는 제품이라기보단 UI 목업에 가까웠다.

## 이전 버전들

Next.js 프로토타입 전에는, 더 완성된 학교 정보 앱 콘셉트용 발표 자료도 만들었다 — 시간표 화면, 급식 메뉴, 공지 게시판까지. 그 시기의 스크린샷:

![App concept 1](/images/projects/sirius/app-1.png)

![App concept 2](/images/projects/sirius/app-2.png)

![App concept 3](/images/projects/sirius/app-3.png)

![App concept 4](/images/projects/sirius/app-4.png)

![App concept 5](/images/projects/sirius/app-5.png)

![App concept 6](/images/projects/sirius/app-6.png)

![App concept 7](/images/projects/sirius/app-7.png)

![App concept 8](/images/projects/sirius/app-8.png)

## 그 뒤로 일어난 일

Sirius는 독립 앱으로 출시되진 못했지만 아이디어는 분명히 남았다 — 몇 년 뒤에 같은 콘셉트를 [TimeforSchool](/projects/timefor-school)(공지 게시판 + 시간표 + 급식 API + MCP)이랑 [SchoolWatch](/projects/school-watch)(watchOS 클라이언트)로 다시 만들었다. 같은 문제, 더 나은 스택, 그리고 실제로 배포까지.

Sirius라는 이름, 그리드 대시보드 콘셉트, 그리고 "학교 정보를 한눈에"라는 지향점은 사실상 이 사이트의 학교 관련 모든 것의 조상이다.

영재교육원에서 제작, 2022년.
