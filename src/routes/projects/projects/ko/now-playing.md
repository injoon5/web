---
title: 'Now Playing'
description: Apple Developer 계정 없이 내 사이트에 애플 뮤직 청취 기록을 띄운 이야기입니다.
year: '2023'
tags:
  - Python
  - GitHub Actions
  - Last.fm
published: true
aiTranslated: true
---

## 짧게 요약하면

이 저장소([injoon5/data](https://github.com/injoon5/data))는 이 사이트의 "now listening" 위젯을 위한 백엔드다. Last.fm에서 내가 지금 듣고 있는 곡을 가져와 JSON 파일로 저장하고, 프론트엔드는 그 파일을 GitHub에서 바로 읽어온다.

전체 이야기는 [내 웹사이트에 "Now Listening" 섹션을 만든 방법](/blog/now-listening)에 적어뒀다 — 애플 뮤직 API의 나이 제한, 내가 스포티파이로 갈아타기를 거부한 이유, 스크로블링에 쓴 Sleeve, 그리고 `raw.githubusercontent.com`을 이용한 CORS 트릭까지.

## 스크립트

`now-playing.py`는 내 사용자명이랑 환경 변수에 담긴 API 키로 Last.fm의 `user.getrecenttracks` 엔드포인트를 호출한 뒤, 응답을 `now-playing.json`에 쓴다. 저장하기 전에 트랙 목록을 **최근 20개**로 잘라낸다 (블로그 글에는 원래 4개라고 적어놨는데 언젠가 늘렸다).

```python
response['recenttracks']['track'] = response['recenttracks']['track'][:20]
```

Last.fm은 현재 재생 중인 트랙을 목록 첫 항목에 `@attr: { nowplaying: "true" }`로 표시한다 — 홈페이지 위젯은 바로 그걸 확인한다.

## GitHub Actions

워크플로(`.github/workflows/update.yml`)는 cron으로 **5분마다** 돌고, `main`에 푸시될 때도 돈다. 매번 실행될 때마다:

1. 푸시 충돌을 피하려고 원격에서 리베이스(`git pull` with rebase)
2. `photos.py` 실행 (별도 위젯 — 최근 사진 JSON)
3. secrets의 `LAST_FM_PUBLIC_API_KEY`로 `now-playing.py` 실행
4. 변경 사항이 있으면 `github-actions[bot]` 이름으로 커밋
5. `REPO_SECRET` 토큰으로 `ad-m/github-push-action`을 통해 푸시

이 전부를 별도 저장소에 둔 게 비용을 아끼는 핵심이다. 봇은 자기 일정대로 새 JSON을 커밋하고, 웹사이트는 새 데이터를 가져오려고 재배포할 필요가 전혀 없다.

## 사이트가 읽어오는 방법

홈페이지는 마운트될 때 클라이언트 쪽에서 fetch를 한다:

```
https://raw.githubusercontent.com/injoon5/data/main/now-playing.json
```

GitHub raw 파일에는 CORS 제한이 없어서 백엔드 프록시가 필요 없다. fetch가 실패하면 위젯은 페이지를 깨뜨리는 대신 에러 상태를 보여준다.

서버도 없고, 비용도 없고, 연 $99짜리 개발자 계정도 없다. 임시방편치고는 나쁘지 않다.
