---
title: '코로나19 교통량 분석'
description: 한국의 사회적 거리두기 단계가 고속도로 교통량에 영향을 줬을까? 나의 첫 데이터 분석 프로젝트입니다.
year: '2021'
tags:
  - Python
  - Pandas
published: true
aiTranslated: true
---

## 질문

코로나19 시기에 한국에는 사람들의 외출 정도를 바꾸는 단계별 사회적 거리두기 규칙이 있었다. 문득 궁금해졌다: **그 단계들이 실제로 교통량에 영향을 줬을까?**

딱히 새로운 연구 주제는 아니지만, 그냥 궁금했고 공공 데이터로 한 번 검증해볼 수 있을 것 같았다.

## 데이터

출처는 두 개:

- **고속도로 영업소 교통량** — [공공데이터포털](https://www.data.go.kr)에서
- **일일 코로나 확진자 수** — 코로나라이브에서

둘 다 CSV로 받아서 **Python이랑 Pandas**로 정리한 다음, 뭔가 패턴이 보이나 싶어서 산점도랑 막대그래프를 그리기 시작했다.

## 알아낸 것

깔끔한 인과 증명 같은 건 없었다 — 상관은 인과가 아니고, 교통량에는 수백만 가지 다른 요인이 작용하니까. 그래도 거리두기 단계 변화랑 교통량 감소 사이에 **눈에 보이는 어떤 관계** 정도는 있었다. 흥미로울 만큼은 됐지만, 논문으로 낼 정도는 아니었다.

근데 더 중요한 건, 이게 내 **첫 진짜 데이터 분석 프로젝트**였다는 점이다 — 데이터를 모으고, 정리하고, 차트 종류를 고르고, 내 가설이 안 맞을 수도 있다는 걸 받아들이는 것까지.

![Slide 3](/images/projects/covid-traffic/slide-3.png)

![Slide 4](/images/projects/covid-traffic/slide-4.png)

![Slide 5](/images/projects/covid-traffic/slide-5.png)

![Slide 6](/images/projects/covid-traffic/slide-6.png)

![Slide 7](/images/projects/covid-traffic/slide-7.png)

![Slide 8](/images/projects/covid-traffic/slide-8.png)

![Slide 9](/images/projects/covid-traffic/slide-9.png)

![Slide 11](/images/projects/covid-traffic/slide-11.png)
