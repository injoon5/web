---
title: 'SchoolWatch'
description: 학교 일과의 지루한 부분들을 위한 watchOS 앱. 시간표랑 남은 시간을 손목에서 바로 봅니다.
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

나는 거의 매일 애플 워치를 찬다. 시간표 보거나 교시 얼마 남았나 확인하려고 쉬는 시간마다 폰 꺼내는 게, 화면이 _바로_ 손목에 있는데도 좀 바보 같았다.

[SchoolWatch](https://github.com/injoon5/SchoolWatch)는 그걸 고쳐보려고 만든 거다. 다른 거랑 똑같은 [school API](/projects/timefor-school)를 부르는데, 45mm 화면에서 돈다는 게 다르다.

## 데모

<LazyVideo src="/videos/projects/schoolwatch.mp4" label="Play SchoolWatch demo" />

## 앱 구조

`ContentView`는 세로로 넘기는 `TabView`고, 탭이 네 개다:

| 탭        | 뷰              | 보여주는 것           |
| --------- | --------------- | --------------------- |
| Today     | `TodayView`     | 오늘 수업 + 급식 메뉴 |
| Timetable | `TimetableView` | 이번 주 전체 시간표   |
| Meals     | `MealView`      | 앞으로 15일 급식      |
| Settings  | `SettingsView`  | 학년 + 반 번호        |

학년이랑 반은 `UserDefaults`에 저장한다(안 정하면 2학년 6반이 기본). 네트워크 호출은 다 이런 식의 URL을 만든다:

```
https://school-api-1i8w.onrender.com/timetable?grade=2&classno=6
```

## 시간표 디테일

`TimetableView`는 API가 주는 `TimetableData`를 디코딩한다. `day_time`(교시 시작 시각), `timetable`(요일별로 중첩), `update_date` 이런 것들. `ClassSchedule`마다 교시, 과목, 교사, `replaced` 플래그가 들어있다. 보강 처리는 좀 뿌듯한 부분인데, 수업이 바뀌면 노란 ⚠️ 아이콘이 뜨고 상세 화면에 원래 과목이랑 교사가 빨간색으로 나온다.

이번 주 `/schedule`도 같이 불러와서 학교 행사(공휴일, 행사)를 얹는다. 어떤 날에 행사가 걸리면 그날은 수업 목록 대신 행사 이름이 뜬다.

**오프라인 대비:** 시간표 JSON을 `UserDefaults`의 `cachedTimetable`에 캐싱해둔다. 워치 연결이 워낙 들쭉날쭉하다 보니, 네트워크가 실패하면 빈 화면 띄우는 대신 조용히 캐시에서 불러온다.

## Today + 급식

`TodayView`는 일단 요일부터 본다. 토요일이나 일요일이면 큼지막한 빨간 **"NO SCHOOL TODAY!"**를 띄우고 API는 아예 안 부른다. 평일엔 시간표에서 오늘 줄을 가져오고, `/lunch?startdate=YYYYMMDD&enddate=YYYYMMDD`에서 오늘 급식을 가져온다.

`MealView`는 15일치를 한 번에 불러와서, 날짜마다 `DDISH_NM`(메뉴, 줄바꿈은 쉼표로)을 칼로리랑 같이 보여준다.

## 상태

watchOS용으로 SwiftUI로 만들었고, 자체 백엔드는 없다. 그냥 [TimeforSchool API](/projects/timefor-school)를 부르는 클라이언트다. 앱스토어에 올릴 만큼 다듬은 건 아니고 개인용 도구에 가까운데, 그래도 손목에 둘 만해서 매일 본다. 궁금하면 소스는 GitHub에 있다.
