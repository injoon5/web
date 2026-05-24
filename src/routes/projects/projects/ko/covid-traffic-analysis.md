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

코로나19 때 한국엔 사람들 외출을 단계별로 조절하는 사회적 거리두기 규칙이 있었다. 문득 궁금해졌다. **그 단계가 진짜 교통량에 영향을 줬을까?**

엄청 새로운 주제는 아닌데, 그냥 궁금하기도 했고 공공 데이터로 한번 확인해볼 수 있을 것 같았다.

## 데이터

가져온 데는 두 군데:

- **고속도로 영업소 교통량**: [공공데이터포털](https://www.data.go.kr)
- **일일 코로나 확진자 수**: 코로나라이브

둘 다 CSV로 받아서 **Python이랑 Pandas**로 정리하고, 뭔가 패턴이 보이나 해서 산점도랑 막대그래프를 그려봤다.

## 알아낸 것

깔끔한 인과관계 같은 건 안 나왔다. 상관이 곧 인과는 아니고, 교통량엔 다른 변수가 너무 많으니까. 그래도 거리두기 단계가 바뀔 때랑 교통량이 줄어드는 거 사이에 **눈에 보이는 관계** 정도는 있었다. 흥미로울 만큼은 되는데 논문 낼 정도는 아니고.

근데 그것보다 중요한 건, 이게 내 **첫 제대로 된 데이터 분석 프로젝트**였다는 거다. 데이터 모으고, 정리하고, 차트 고르고, 내 가설이 틀릴 수도 있다는 걸 받아들이는 거까지 다 해봤다.

![Slide 3](/images/projects/covid-traffic/slide-3.png)

![Slide 4](/images/projects/covid-traffic/slide-4.png)

![Slide 5](/images/projects/covid-traffic/slide-5.png)

![Slide 6](/images/projects/covid-traffic/slide-6.png)

![Slide 7](/images/projects/covid-traffic/slide-7.png)

![Slide 8](/images/projects/covid-traffic/slide-8.png)

![Slide 9](/images/projects/covid-traffic/slide-9.png)

![Slide 11](/images/projects/covid-traffic/slide-11.png)
