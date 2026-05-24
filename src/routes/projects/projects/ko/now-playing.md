---
title: 'Now Playing'
description: Apple Developer 계정 없이 내 사이트에 애플 뮤직 청취 기록을 띄워 봤습니다.
year: '2023'
tags:
  - Python
  - GitHub Actions
  - Last.fm
published: true
aiTranslated: true
---

## 짧게 요약하면

이 저장소([injoon5/data](https://github.com/injoon5/data))는 이 사이트 "now listening" 위젯의 백엔드다. Last.fm에서 내가 지금 듣는 곡을 가져와서 JSON 파일로 저장해두면, 프론트엔드가 그걸 GitHub에서 바로 읽어간다.

전체 이야기는 [내 웹사이트에 "Now Listening" 섹션을 만든 방법](/blog/now-listening)에 다 적어놨다. 애플 뮤직 API 나이 제한이라든지, 스포티파이로 갈아타기 싫었던 이유, 스크로블링에 쓴 Sleeve, `raw.githubusercontent.com` CORS 트릭 같은 거.

## 스크립트

`now-playing.py`는 내 사용자명이랑 환경 변수에 넣어둔 API 키로 Last.fm `user.getrecenttracks`를 호출하고, 응답을 `now-playing.json`에 쓴다. 저장하기 전에 트랙은 **최근 20개**까지만 잘라낸다 (블로그엔 원래 4개라고 써놨는데 언젠가 늘렸다).

```python
response['recenttracks']['track'] = response['recenttracks']['track'][:20]
```

Last.fm은 지금 재생 중인 트랙을 목록 맨 앞에 `@attr: { nowplaying: "true" }`로 표시해준다. 홈페이지 위젯은 그걸 보고 판단한다.

## GitHub Actions

워크플로(`.github/workflows/update.yml`)는 cron으로 **5분마다** 돌고, `main`에 푸시될 때도 돈다. 한 번 돌 때마다:

1. 푸시 충돌 안 나게 원격에서 리베이스 (`git pull` with rebase)
2. `photos.py` 실행 (최근 사진 JSON 만드는 별도 위젯)
3. secrets에 있는 `LAST_FM_PUBLIC_API_KEY`로 `now-playing.py` 실행
4. 바뀐 게 있으면 `github-actions[bot]` 이름으로 커밋
5. `REPO_SECRET` 토큰으로 `ad-m/github-push-action` 써서 푸시

이걸 전부 별도 저장소에 둔 게 핵심인데, 덕분에 봇이 알아서 새 JSON을 커밋해도 웹사이트를 다시 배포할 필요가 없다.

## 사이트에서 읽어가는 방법

홈페이지는 마운트될 때 클라이언트에서 그냥 fetch 한다:

```
https://raw.githubusercontent.com/injoon5/data/main/now-playing.json
```

GitHub raw 파일은 CORS 제한이 없어서 백엔드 프록시 같은 게 필요 없다. fetch가 실패하면 페이지를 깨뜨리는 대신 위젯에 에러 상태를 보여준다.

서버도 없고, 돈도 안 들고, 연 $99짜리 개발자 계정도 필요 없다. 임시방편치곤 꽤 괜찮다.
