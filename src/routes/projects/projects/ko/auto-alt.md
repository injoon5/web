---
title: 'AutoAlt'
description: 스크린 리더 사용자를 위해 신발 이미지를 설명해 주는 브라우저 확장 프로그램 — LG AI 영재 캠프에서 제작.
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

온라인 쇼핑을 하는 시각장애인은 상품 이미지 앞에서 종종 벽에 부딪힙니다. 스크린 리더가 화면에 무엇이 있는지 읽어 주려면 **대체 텍스트(alt text)**가 필요한데, 대부분의 쇼핑몰에는 그게 없습니다. 페이지가 그냥 "이미지"라고 열두 번 말해 버리면 신발 두 켤레를 구분할 방법이 없죠.

우리 팀은 2024년 [LG AI 영재 캠프](https://www.lgdlab.or.kr/) — LG Discovery Lab과 서울대학교가 함께 운영하는 프로그램 — 도중에 이 문제를 발견했습니다. 약 세 달 동안 해결책을 만드는 데 매달렸습니다.

## 우리가 만든 것

**AutoAlt**는 상품 이미지를 받아 직접 학습시킨 객체 탐지 모델에 통과시킨 뒤, 그 결과를 GPT-4에 넘겨 자연스러운 문장 설명으로 바꿉니다. 최종적으로 나오는 것은 스크린 리더가 실제로 소리 내어 읽을 수 있는 텍스트입니다.

프로젝트를 진행하면서 범위를 많이 좁혔습니다. "쇼핑몰의 모든 의류"로 시작했지만, 주어진 시간 안에 안정적으로 학습시킬 수 있는 유일한 카테고리였던 **신발**로 끝났습니다.

### 스택

- **YOLOv8** — 제 맥북 프로에서 학습 (MPS 가속 — 팬 소리가 제트기처럼 들리는 걸 처음 경험했습니다)
- **FastAPI** 백엔드 — 이미지를 받아 모델 JSON을 반환
- **GPT-4 Turbo** — `{type: "sneaker", laces: true}`를 완성된 문장으로 변환
- 단일 HTML 프런트엔드 — 이미지 우클릭 컨텍스트 메뉴로 실행

팀에서 개발자는 저 혼자였습니다. 나머지 팀원들은 기획, 디자인, 발표를 맡았습니다.

## 결과

최종 시상식에서 **세 개의 상**을 받았습니다 — LG 인재상, 성장상, 탐구상 — 그리고 저는 개인 자격으로 **미국 실리콘밸리 연수** 대상자로 선발되었습니다.

![LG awards](/images/projects/auto-alt/lg-award.png)

![Camp poster](/images/projects/auto-alt/poster.png)

![SNU camp](/images/projects/auto-alt/snu-camp.png)

![Award ceremony](/images/projects/auto-alt/award-ceremony.png)

미국 캠프 중 스탠퍼드에서는 경미한 교통 위반에 대한 AI 법률 상담 챗봇도 프로토타입으로 만들었습니다 — 다른 프로젝트였지만, 같은 디자인 싱킹 에너지였죠.

![Stanford certificate](/images/projects/auto-alt/stanford-cert.png)

## 더 보기

지원 마감 직전의 패닉, 서울대 기숙사 밤샘, 노트북에서 돌린 YOLO 학습까지 — 전체 이야기는 [LG AI 영재 캠프 블로그 글](/blog/lg-ai-youth-camp)에 담았습니다. [미국 캠프 후기](/blog/us-camp)에서는 실리콘밸리 이야기를 다룹니다.

![Project overview video](/images/projects/auto-alt/overview.png)
