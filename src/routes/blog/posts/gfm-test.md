---
type: note
title: GFM TEST
description: GFM TEST
date: '2024-1-27'
tags:
  - sveltekit
  - svelte
published: false
---

가난한 **별** 이제 까닭이요, ~~벌레~~는 그 때 까닭이요, _버리었습니다_.
마디씩 패, 애기 불러 계십니다. 한 새워 이제 어머님, 봅니다. 아직 그리워 파란 별을 봅니다. 하나 묻힌 가슴속에 봅니다. 책상을 까닭이요, 노새, 마리아 버리었습니다.

## h2 제목

그리고 위에도 그러나 흙으로 듯합니다. 비둘기, 마리아 추억과 내 프랑시스 이런 소녀들의 봅니다. 새워 무성할 밤을 별 계십니다. 둘 가득 부끄러운 우는 못 때 동경과 어머니, 별 봅니다. 덮어 걱정도 그리워 버리었습니다. 헤는 내 책상을 노루, 나의 거외다.

### h3 제목

이네들은 계집애들의 부끄러운 별 같이 이웃 위에도 경, 별들을 거외다.

> [잔디](/)가 불러 나는 계십니다.
> 책상을 피어나듯이 쓸쓸함과 새겨지는 걱정도 풀이 언덕 봅니다.

부끄러운 쉬이 옥 다하지 다 별 나는 이런 봄이 계십니다.

---

[일반 링크](/)
[**굵은 링크**](/)
자동 파싱되는 링크 https://github.com/bepyan

[`코드 링크`](/)
[**`굵은 코드 링크`**](/)

---

목록

- 모든 국민은 행위시의 법률에 의하여 범죄를 구성하지 아니하는 행위로 소추되지 아니하며, 동일한 범죄에 대하여 거듭 처벌받지 아니한다.
- 이 헌법에 의한 최초의 대통령의 임기는 이 헌법시행일로부터 개시한다.
  - 모든 국민은 능력에 따라 균등하게 교육을 받을 권리를 가진다.

순서 목록

1. 헌법개정은 국회재적의원 과반수 또는 대통령의 발의로 제안된다.
2. 국군은 국가의 안전보장과 국토방위의 신성한 의무를 수행함을 사명으로 하며, 그 정치적 중립성은 준수된다.

## 코드

`inline code` `[1, 2, 3]{:js}`

```
Block code
```

```ts
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
```

```tsx {3} title="layout.tsx" caption="가난한 별 이제 까닭이요, 벌레는 그 때 까닭이요, 버리었습니다." showLineNumbers
import '~/styles/globals.css';

import type { Metadata } from 'next';

import { fontMono, fontSans, fontSerif } from '~/libs/fonts';
import { cn } from '~/libs/utils';

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="ko" suppressHydrationWarning>
			<body
				className={cn(
					'bg-background min-h-screen font-sans antialiased',
					fontSans.variable,
					fontSerif.variable,
					fontMono.variable
				)}
			>
				<div className="blur" aria-hidden="true"></div>
				<div className="max-w-page container mx-auto pt-32">
					<div className="main-grid">{children}</div>
				</div>
			</body>
		</html>
	);
}
```

## 테이블

| 상태   | 설명                                                                                       |
| ------ | ------------------------------------------------------------------------------------------ |
| 기쁨   | _Pleasure, Joy, Happiness, Delight._ 욕구가 충족되었을 때의 흐뭇하고 흡족한 마음이나 느낌. |
| 슬픔   | 원통한 일을 겪거나 불쌍한 일을 보고 마음이 아프고 괴로운 느낌.                             |
| 즐거움 | 마음에 거슬림이 없이 흐뭇하고 기쁜 느낌.                                                   |

|      |                                        |
| ---- | -------------------------------------- |
| 쾌락 | 유쾌하고 즐거움. 또는 그런 느낌.       |
| 안락 | 몸과 마음이 편안하고 즐거움.           |
| 희락 | 기쁨과 즐거움. 또는 기뻐함과 즐거워함. |

| 좌  | 중앙 |  우 |
| --- | :--: | --: |
| 가  |  나  |  다 |

## 이미지

![Example Photo](https://picsum.photos/200/300)_wow_

## 임베드

[This](https://www.youtube.com/watch?v=dQw4w9WgXcQ) is a great YouTube video.
Watch it here:

https://www.youtube.com/watch?v=dQw4w9WgXcQ

Isn't it great!?
