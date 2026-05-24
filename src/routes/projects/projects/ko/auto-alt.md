---
title: 'AutoAlt'
description: 스크린 리더 사용자에게 신발 이미지를 설명해 주는 브라우저 확장 프로그램. LG AI 청소년 캠프에서 만들었습니다.
year: '2024'
tags:
  - Python
  - YOLOv8
  - FastAPI
  - GPT-4
published: true
aiTranslated: true
---

## 문제

시각장애인이 온라인 쇼핑을 하다 보면 상품 이미지에서 막히는 경우가 많다. 스크린 리더가 화면에 뭐가 있는지 읽어주려면 **대체 텍스트(alt text)**가 필요한데, 정작 대부분의 쇼핑몰엔 그게 없다. 페이지가 그냥 "이미지"만 열두 번 읽어주면 신발 두 켤레를 구분할 방법이 없는 거다.

우리 팀은 2024년 [LG AI 청소년 캠프](https://www.lgdlab.or.kr/)에 참여하다가 이 문제를 발견했다. LG 디스커버리랩이랑 서울대학교가 같이 운영하는 프로그램인데, 여기에 약 세 달 동안 매달렸다.

## 우리가 만든 것

**AutoAlt**은 상품 이미지를 받아서 직접 학습시킨 객체 탐지 모델에 한 번 통과시키고, 그 결과를 GPT-4에 넘겨서 자연스러운 문장으로 바꾼다. 그렇게 나온 게 스크린 리더가 실제로 읽어줄 수 있는 텍스트다.

진행하면서 범위를 엄청 좁혔다. 처음엔 "쇼핑몰의 모든 의류"로 시작했는데, 주어진 시간 안에 제대로 학습시킬 수 있는 게 결국 **신발**밖에 없었다.

### 스택

- **YOLOv8**: 내 맥북 프로로 학습시켰다 (MPS 가속. 컴퓨터 사고 처음으로 팬 소리가 비행기 이륙 소리처럼 났다)
- **FastAPI** 백엔드: 이미지를 받아서 모델 JSON을 돌려준다
- **GPT-4 Turbo**: `{type: "sneaker", laces: true}` 같은 걸 완성된 문장으로 바꿔준다
- 프론트엔드는 HTML 파일 하나. 이미지 우클릭하면 뜨는 컨텍스트 메뉴로 실행된다

팀에서 프로그래밍 할 줄 아는 사람이 나밖에 없어서, 나머지 3명이 기획이랑 디자인, 발표를 맡았다.

## 결과

최종 시상식에서 상을 3개 받았다. LG 인재상, 성장상, 탐구상. 그리고 개인 자격으로 **미국 실리콘밸리 연수** 대상자로도 뽑혔다.

![LG awards](/images/projects/auto-alt/lg-award.png)

![Camp poster](/images/projects/auto-alt/poster.png)

![SNU camp](/images/projects/auto-alt/snu-camp.png)

![Award ceremony](/images/projects/auto-alt/award-ceremony.png)

미국 캠프 때 스탠포드에서는 가벼운 교통 위반 변호에 쓰는 AI 법률 상담 챗봇도 만들어 봤다. 다른 프로젝트긴 한데 결은 비슷했다.

![Stanford certificate](/images/projects/auto-alt/stanford-cert.png)

## 더 보기

지원 마감 직전 패닉이라든지 서울대 기숙사 밤샘, 노트북으로 YOLO 돌린 거까지 전체 이야기는 [LG AI 청소년 캠프 후기](/blog/lg-ai-youth-camp)에 적어놨다. 실리콘밸리 쪽은 [미국 캠프 후기](/blog/us-camp)에서 다룬다.

![Project overview video](/images/projects/auto-alt/overview.png)
