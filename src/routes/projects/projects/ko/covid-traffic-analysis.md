---
title: '코로나19 교통량 분석'
description: 한국의 사회적 거리두기 단계가 고속도로 교통량에 영향을 줬을까? 나의 첫 데이터 분석 프로젝트.
year: '2021'
tags:
  - Python
  - Pandas
published: true
aiTranslated: true
---

## 질문

코로나19 시기 한국에는 사람들의 외출 정도를 바꾸는 단계별 사회적 거리두기 규칙이 있었습니다. 문득 궁금해졌습니다: **그 단계들이 실제로 교통량에 영향을 줬을까?**

딱히 새로운 연구 주제는 아니지만, 호기심이 생겼고 공공 데이터로 검증해 볼 수 있을 것 같았습니다.

## 데이터

두 가지 출처:

- **고속도로 영업소 교통량** — [공공데이터포털](https://www.data.go.kr)에서
- **일일 코로나 확진자 수** — 코로나라이브에서

둘 다 CSV로 받아 **Python과 Pandas**로 정리한 뒤, 어떤 패턴이 드러나는지 보려고 산점도와 막대그래프를 그리기 시작했습니다.

## 알아낸 것

깔끔한 인과 증명은 없었습니다 — 상관은 인과가 아니고, 교통량에는 수백만 가지 다른 요인이 작용하니까요. 하지만 거리두기 단계 변화와 교통량 감소 사이에 **눈에 보이는 어떤 관계**는 있었습니다. 흥미로울 정도는 됐지만, 학술지에 실을 정도는 아니었죠.

더 중요한 건, 이게 제 **첫 진짜 데이터 분석 프로젝트**였다는 점입니다 — 데이터를 모으고, 정리하고, 차트 종류를 고르고, 내 가설이 들어맞지 않을 수도 있다는 걸 받아들이는 것까지요.

![Slide 3](/images/projects/covid-traffic/slide-3.png)

![Slide 4](/images/projects/covid-traffic/slide-4.png)

![Slide 5](/images/projects/covid-traffic/slide-5.png)

![Slide 6](/images/projects/covid-traffic/slide-6.png)

![Slide 7](/images/projects/covid-traffic/slide-7.png)

![Slide 8](/images/projects/covid-traffic/slide-8.png)

![Slide 9](/images/projects/covid-traffic/slide-9.png)

![Slide 11](/images/projects/covid-traffic/slide-11.png)
