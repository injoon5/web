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

수학 시간엔 `3 + 4`라고 쓴다. 피연산자 사이에 연산자가 들어가는 이게 **중위(infix)** 표기법이다. 근데 컴파일러나 HP 계산기 같은 걸 본 적 있으면 `3 4 +` 이렇게 써있는 걸 봤을 거다. **후위(postfix, 역폴란드)** 표기법은 연산자를 피연산자 뒤에 둔다.

나는 컴퓨터가 그걸 쓴다는 사실보다, _왜_ 그걸 더 좋아하는지가 궁금했다.

## 알아낸 것

알고 보니 후위 표기법은 **스택**이랑 딱 맞아떨어진다. 왼쪽부터 읽으면서 숫자는 쌓아두고, 연산자가 나오면 위에서 두 개 꺼내 계산한 다음 결과를 다시 쌓는다. 괄호도 필요 없고 연산 순서가 헷갈릴 일도 없다. 바이트코드나 계산기, 수식 파서에서 후위 표기법을 쓰는 게 다 이 이유다.

중위 표기법은 우리가 말하는 방식이랑 비슷해서 사람한테 편하고, 후위 표기법은 애매한 구석이 없고 한 번에 쭉 계산할 수 있어서 기계한테 편하다.

## 만든 것

이런 걸 하는 Python 스크립트:

1. 스택으로 **후위 → 중위 변환**
2. 피연산자를 쌓고 꺼내면서 **후위 수식 계산**

둘 다 결국 똑같은 스택 패턴이다. 사실 그게 전부다.

![Research overview](/images/projects/postfix-notation/main.png)

![Stack conversion](/images/projects/postfix-notation/part-1.png)

![Evaluation walkthrough](/images/projects/postfix-notation/part-2.png)

![Code examples](/images/projects/postfix-notation/part-3.png)

![Results](/images/projects/postfix-notation/part-4.png)

## 맥락

2020년쯤 한 연구 프로젝트다. 웹 앱 같은 거 만들기 한참 전, 중학교 막 들어갔을 때. 그땐 좀 뜬금없는 거 같았는데, 나중에 실제 프로젝트에서 뭔가 파싱할 일이 생길 때마다 스택이랑 수식 파싱이 자꾸 다시 나왔다.
