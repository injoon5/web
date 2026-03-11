---
type: blog
title: 내 웹사이트의 "지금 듣는 음악" 섹션을 만든 방법
slug: '{{slug}}'
description: 'Apple Music API를 사용하지 않고, Last.fm과 GitHub Actions를 활용한 꿀팁을 발견했습니다.'
date: '2025-02-09'
coverimage: ''
published: true
---

## 아이디어

얼마 전 [cho.sh](https://cho.sh)—선현 조의 개인 사이트—를 둘러보다가, 현재 듣고 있는 음악을 실시간으로 웹사이트에 보여주는 정말 멋진 "지금 재생 중" 섹션을 발견했습니다. 저도 바로 갖고 싶어졌습니다.

그래서 어떻게 만들지 찾아보기 시작했습니다.

## 문제: Apple Music API

저는 수년째 Apple Music을 사용하고 있습니다. 당연히 Apple Music API를 통해 청취 데이터를 가져오는 방법을 먼저 찾아봤는데, Apple Developer 계정이 필요하더군요.

Apple Developer 계정은 연간 $99인데, 뭐 그건 그렇다 치더라도 진짜 문제는 **만 18세 이상이어야 가입할 수 있다**는 점입니다. 저는 고등학생이라 조건이 안 됩니다. 완전히 막힌 거죠.

## 방법 1: Spotify로 갈아타기?

Spotify API는 무료이고 나이 제한도 없습니다. 이론적으로는 그냥 갈아타면 되는 거죠.

![Spotify 데스크탑 앱 UI](/images/uploads/now-playing/spotify-screenshot.png)

아니요.

## 방법 2: Last.fm

[Last.fm](https://www.last.fm)은 2002년부터 존재해온 음악 트래킹 서비스입니다. 작동 방식은 이렇습니다: 음악 플레이어와 연동해서 재생하는 모든 트랙을 "스크로블"(기록)합니다. 나이 제한 없는 무료 API를 제공합니다.

핵심은 바로 이겁니다: **Apple Music을 Last.fm에 동기화할 수 있습니다.** Apple Music에서 재생하는 모든 곡이 자동으로 Last.fm 프로필에 스크로블됩니다. 문제가 해결됐습니다(정확히는, 데이터를 실제로 가져와서 표시하는 건 아직 남아있지만, 데이터 소스는 확보했습니다).

## Sleeve

macOS에서 Apple Music → Last.fm 동기화를 실제로 활성화하기 위해 [Sleeve](https://replay.software/sleeve)라는 앱을 사용했습니다.

Sleeve는 데스크탑에 떠 있으면서 현재 재생 중인 트랙의 앨범 아트를 보여주는 작은 macOS 앱입니다. 정말 깔끔하게 생겼어요:

![Sleeve가 데스크탑에 앨범 아트를 표시하는 모습](/images/uploads/now-playing/sleeve-example.png)

더 중요한 건, Sleeve에 Last.fm 스크로블링 토글이 내장되어 있다는 점입니다. 켜고 Last.fm 계정을 연결하면, Apple Music에서 재생하는 모든 곡이 자동으로 기록됩니다. 그냥 됩니다.

## Python 스크립트

Last.fm에 청취 이력이 쌓이면, 이제 실제로 가져와서 웹사이트가 읽을 수 있는 곳에 저장해야 합니다.

Last.fm에는 [`user.getrecenttracks`](https://www.last.fm/api/show/user.getrecenttracks)라는 엔드포인트가 있는데, 최근 재생한 트랙을 반환합니다. 현재 재생 중인 트랙이 있으면 `@attr: { nowplaying: "true" }` 플래그가 붙습니다. 딱 맞네요.

그 엔드포인트를 호출해서 결과를 JSON 파일로 저장하는 짧은 Python 스크립트를 작성했습니다:

```python
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

url = f'http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=injoon5&api_key={os.environ["LAST_FM_PUBLIC_API_KEY"]}&format=json'

headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
}

def get_now_playing():
    result = requests.get(url, headers=headers)
    return result

if __name__ == '__main__':
    response = get_now_playing().json()
    response['recenttracks']['track'] = response['recenttracks']['track'][:4]

    with open('now-playing.json', 'w') as f:
        json.dump(response, f, indent=2)
```

전체 스크립트(GitHub Actions 워크플로 포함)는 [github.com/injoon5/data](https://github.com/injoon5/data)에서 확인할 수 있습니다.

## GitHub Actions의 활약

스크립트는 GitHub Actions 워크플로를 통해 5분마다 실행됩니다. Last.fm에서 최신 데이터를 가져와 `now-playing.json`에 쓰고, 결과를 저장소에 커밋합니다.

덕분에 `now-playing.json`은 항상 최신 상태—길어야 5분 이내의 데이터—를 유지합니다.

## CORS 이야기

여기서 재밌는 부분이 나옵니다. GitHub에서 제공하는 raw 파일(`raw.githubusercontent.com`)에는 CORS 제한이 없습니다. 따라서 제 웹사이트는 별도의 백엔드나 서버리스 함수 없이 `now-playing.json`을 GitHub에서 직접 가져올 수 있습니다.

전체 흐름을 정리하면:

1. Apple Music에서 음악을 듣습니다
2. Sleeve가 Last.fm에 스크로블합니다
3. GitHub Actions가 5분마다 데이터를 가져와 JSON 파일로 씁니다
4. 웹사이트가 GitHub에서 직접 그 JSON 파일을 가져옵니다
5. "지금 듣는 음악" 위젯이 업데이트됩니다

서버도 없고, 비용도 없고, Apple Developer 계정도 필요 없습니다.

나쁘지 않은 우회책이죠.
