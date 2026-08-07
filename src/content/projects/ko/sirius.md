---
title: 'Sirius 앱'
description: 시간표, 공지, 학급 정보를 한곳에 모은 학교 대시보드 앱. 영재교육원에서 시작했습니다.
year: '2022'
tags:
  - Swift
  - Python
  - Next.js
published: true
aiTranslated: true
---

## 무엇이었나

**Sirius**(`학교 정보를 한눈에`)는 [영재교육원](https://github.com/injoon5/sirius-web)에서 만든 학교생활 앱이었다. 앱 세 개랑 카톡 단톡방을 왔다 갔다 하는 대신, 시간표랑 공지, 쉬는 시간에 필요한 것들을 한곳에 모아보자는 생각이었다.

원래 목표는 학교 데이터를 긁어오고 가공하는 **Python** 백엔드에 네이티브 **Swift** 앱이었다. GitHub에 올라가 있는 건 웹 프로토타입인 [sirius-web](https://github.com/injoon5/sirius-web), Next.js + Tailwind 대시보드다.

## 웹 프로토타입

StackBlitz에서 만들어서 GitHub으로 빼냈다. 홈페이지는 그리드 레이아웃 중에서도 진짜 단순한 축에 든다:

- 헤더: **Sirius**랑 태그라인
- 프로필 카드 (아바타, 이름, 학교. 데모에선 이대부속초등학교로 박아놨다)
- 번호 붙은 타일 3×3 그리드(`01`~`09`). 시간표, 급식, 숙제 같은 거 들어갈 자리

설정이랑 로그아웃 링크는… 릭롤이다. (`youtube.com/watch?v=dQw4w9WgXcQ`.) 그때 나 13살이었다 ㅋㅋ

스택은 Next.js pages 라우터에 Tailwind CSS, 공개 저장소엔 백엔드가 안 붙어있다. 이때까진 굴러가는 제품이라기보단 UI 목업에 가까웠다.

## 이전 버전들

Next.js 프로토타입 전에는, 좀 더 완성된 학교 정보 앱 콘셉트로 발표 자료를 만들기도 했다. 시간표 화면, 급식 메뉴, 공지 게시판 같은 거. 그때 스크린샷들:

![App concept 1](/images/projects/sirius/app-1.png)

![App concept 2](/images/projects/sirius/app-2.png)

![App concept 3](/images/projects/sirius/app-3.png)

![App concept 4](/images/projects/sirius/app-4.png)

![App concept 5](/images/projects/sirius/app-5.png)

![App concept 6](/images/projects/sirius/app-6.png)

![App concept 7](/images/projects/sirius/app-7.png)

![App concept 8](/images/projects/sirius/app-8.png)

## 그 뒤로

Sirius는 독립 앱으로 나오진 못했는데, 아이디어는 확실히 남았다. 몇 년 뒤에 같은 콘셉트를 [TimeforSchool](/projects/timefor-school)(공지 게시판 + 시간표 + 급식 API + MCP)이랑 [SchoolWatch](/projects/school-watch)(watchOS 클라이언트)로 다시 만들었다. 같은 문제, 더 나은 스택, 그리고 이번엔 진짜 배포까지 했다.

Sirius라는 이름이랑 그리드 대시보드 콘셉트, "학교 정보를 한눈에"라는 방향성은 사실상 이 사이트에 있는 학교 관련 프로젝트 전부의 조상인 셈이다.

영재교육원에서 만듦, 2022년.
