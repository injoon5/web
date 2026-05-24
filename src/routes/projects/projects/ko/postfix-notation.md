---
title: '후위 표기법 연구'
description: 컴퓨터가 후위 표기법을 쓰는 이유 — 그리고 스택으로 변환하고 계산하는 Python 코드.
year: '2020'
tags:
  - Python
published: true
aiTranslated: true
---

## 왜 알아봤나

수학 시간에는 `3 + 4`라고 씁니다 — 피연산자 사이에 연산자가 오죠. 이게 **중위(infix)** 표기법입니다. 하지만 컴파일러나 HP 계산기를 본 적이 있다면 `3 4 +` 같은 걸 봤을 겁니다. **후위(postfix, 역폴란드)** 표기법은 연산자를 피연산자 뒤에 둡니다.

저는 컴퓨터가 단지 그걸 쓴다는 사실이 아니라, *왜* 그걸 선호하는지가 궁금했습니다.

## 알아낸 것

알고 보니 후위 표기법은 **스택**에 깔끔하게 들어맞습니다. 왼쪽에서 오른쪽으로 읽으며 숫자는 push하고, 연산자를 만나면 두 값을 pop해서 계산한 뒤 결과를 push합니다. 괄호도 없고, 연산 순서의 모호함도 없습니다. 바이트코드, 계산기, 수식 파서에 후위 표기법이 등장하는 이유가 바로 이것이죠.

중위 표기법은 우리가 말하는 방식과 닮아서 사람이 선호하고, 후위 표기법은 모호함이 없고 한 번에 계산할 수 있어서 기계가 선호합니다.

## 만든 것

다음을 하는 Python 스크립트:

1. 스택으로 **후위 → 중위 변환**
2. 피연산자를 push/pop 하며 **후위 수식 계산**

둘 다 똑같은 스택 패턴에 기댑니다 — 사실 그게 전부의 비결이에요.

![Research overview](/images/projects/postfix-notation/main.png)

![Stack conversion](/images/projects/postfix-notation/part-1.png)

![Evaluation walkthrough](/images/projects/postfix-notation/part-2.png)

![Code examples](/images/projects/postfix-notation/part-3.png)

![Results](/images/projects/postfix-notation/part-4.png)

## 맥락

2020년쯤 진행한 연구 프로젝트입니다 — 웹 앱을 만들기 한참 전, 중학교 초였죠. 그때는 옆길로 새는 것처럼 느껴졌지만, 실제 프로젝트에서 무언가를 파싱해야 할 때마다 스택과 수식 파싱이 자꾸 다시 등장했습니다.
