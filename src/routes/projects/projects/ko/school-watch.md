---
title: 'SchoolWatch'
description: 학교 일과의 지루한 부분들을 위한 watchOS 앱 — 시간표, 시간 확인, 한눈에 보기.
year: '2024'
tags:
  - Swift
  - watchOS
published: true
aiTranslated: true
---

<script>
	import LazyVideo from '$lib/LazyVideo.svelte';
</script>

## 왜 워치 앱인가

저는 거의 매일 애플 워치를 찹니다. 시간표를 확인하거나 교시가 얼마나 남았는지 보려고 쉬는 시간마다 휴대폰을 꺼내는 게, 화면이 *바로 거기* 손목에 있는데도, 멍청하게 느껴졌습니다.

[SchoolWatch](https://github.com/injoon5/SchoolWatch)는 그걸 고쳐 보려는 시도입니다 — 다른 모든 것과 똑같은 [school API](/projects/timefor-school)를 호출하되, 45mm 화면 위에서 돌아가는 watchOS 앱이죠.

## 데모

<LazyVideo src="/videos/projects/watch.mp4" label="Play SchoolWatch demo" />

## 앱 구조

`ContentView`는 탭이 네 개인 세로 페이지 `TabView`입니다:

| 탭 | 뷰 | 보여 주는 것 |
| --- | ---- | ------------- |
| Today | `TodayView` | 오늘의 수업 + 급식 메뉴 |
| Timetable | `TimetableView` | 이번 주 전체 시간표 |
| Meals | `MealView` | 향후 15일 급식 |
| Settings | `SettingsView` | 학년 + 반 번호 |

학년과 반은 `UserDefaults`에 저장됩니다(설정 안 하면 2학년 6반이 기본값). 모든 네트워크 호출은 이런 URL을 만듭니다:

```
https://school-api-1i8w.onrender.com/timetable?grade=2&classno=6
```

## 시간표 세부 사항

`TimetableView`는 API의 `TimetableData` 구조를 디코딩합니다 — `day_time`(교시 시작 시각), `timetable`(요일별 중첩), `update_date`. 각 `ClassSchedule`은 교시, 과목, 교사, 그리고 `replaced` 플래그를 담습니다. 보강(대체) 수업 처리는 제가 조용히 자랑스러워하는 부분인데요: 수업이 바뀌면 노란색 ⚠️ 아이콘이 뜨고, 상세 화면에 원래 과목과 교사가 빨간색으로 표시됩니다.

또한 이번 주의 `/schedule`을 가져와 학교 행사(공휴일, 행사)를 겹쳐 보여 줍니다 — 어떤 날에 행사가 걸리면 그날은 수업 목록 대신 행사 이름이 표시됩니다.

**오프라인 폴백:** 시간표 JSON은 `UserDefaults`의 `cachedTimetable`에 캐시됩니다. 워치 연결이 워낙 그렇다 보니, 네트워크 요청이 실패하면 빈 화면을 멍하니 보여 주는 대신 조용히 캐시에서 불러옵니다.

## Today + 급식

`TodayView`는 먼저 요일을 확인합니다 — 토/일요일에는 큼지막한 빨간 **"NO SCHOOL TODAY!"**를 띄우고 API 호출을 건너뜁니다. 평일에는 시간표에서 오늘 행을 가져오고, `/lunch?startdate=YYYYMMDD&enddate=YYYYMMDD`에서 오늘의 급식을 가져옵니다.

`MealView`는 15일 구간을 가져와 매일의 `DDISH_NM`(메뉴, 줄바꿈 → 쉼표)을 칼로리 정보와 함께 나열합니다.

## 상태

watchOS용으로 SwiftUI로 만들었고, 자체 백엔드는 없습니다 — [TimeforSchool API](/projects/timefor-school)를 호출하는 순수 클라이언트입니다. 잘 다듬은 앱스토어 출시작이라기보다는 개인 도구에 가깝지만, 제 손목에 한 자리를 차지할 만했고 매일 확인합니다. 둘러보고 싶다면 소스는 GitHub에 있습니다.
