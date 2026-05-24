---
title: '후위 표기법 연구'
description: 컴퓨터가 후위 표기법을 쓰는 이유, 그리고 스택으로 변환하고 계산하는 Python 코드입니다.
year: '2020'
tags:
  - Python
published: true
aiTranslated: true
---

## 왜 알아봤나

수학 시간에는 `3 + 4`라고 쓴다 — 피연산자 사이에 연산자가 온다. 이게 **중위(infix)** 표기법이다. 근데 컴파일러나 HP 계산기를 본 적 있으면 `3 4 +` 같은 걸 봤을 거다. **후위(postfix, 역폴란드)** 표기법은 연산자를 피연산자 뒤에 둔다.

나는 컴퓨터가 그냥 그걸 쓴다는 사실 말고, *왜* 그걸 선호하는지가 궁금했다.

## 알아낸 것

알고 보니 후위 표기법은 **스택**에 깔끔하게 들어맞는다. 왼쪽에서 오른쪽으로 읽으면서 숫자는 push하고, 연산자를 만나면 두 값을 pop해서 계산한 뒤 결과를 push한다. 괄호도 없고 연산 순서가 헷갈릴 일도 없다. 바이트코드, 계산기, 수식 파서에 후위 표기법이 등장하는 게 바로 이 이유다.

중위 표기법은 우리가 말하는 방식이랑 닮아서 사람이 선호하고, 후위 표기법은 모호함이 없고 한 번에 계산할 수 있어서 기계가 선호한다.

## 만든 것

이런 걸 하는 Python 스크립트:

1. 스택으로 **후위 → 중위 변환**
2. 피연산자를 push/pop 하면서 **후위 수식 계산**

둘 다 똑같은 스택 패턴에 기댄다 — 사실 그게 비결의 전부다.

![Research overview](/images/projects/postfix-notation/main.png)

![Stack conversion](/images/projects/postfix-notation/part-1.png)

![Evaluation walkthrough](/images/projects/postfix-notation/part-2.png)

![Code examples](/images/projects/postfix-notation/part-3.png)

![Results](/images/projects/postfix-notation/part-4.png)

## 맥락

2020년쯤 한 연구 프로젝트다 — 웹 앱을 만들기 한참 전, 중학교 초였다. 그때는 옆길로 새는 것처럼 느껴졌는데, 실제 프로젝트에서 뭔가를 파싱해야 할 때마다 스택이랑 수식 파싱이 자꾸 다시 튀어나왔다.
