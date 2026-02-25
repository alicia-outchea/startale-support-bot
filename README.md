# Discord 티켓 자동응답 봇

티켓 채널에서 유저가 메시지를 보내면 자동으로 안내 메시지를 답장합니다.

## 1) 설치

```bash
npm install
```

## 2) 환경변수 설정

```bash
cp .env.example .env
```

`.env`에서 `DISCORD_TOKEN`을 반드시 설정하세요.

## 3) 실행

```bash
npm start
```

## 동작 방식

- 티켓 채널 판별:
- `TICKET_CATEGORY_ID`를 설정하면 해당 카테고리의 텍스트 채널에서만 동작
- 미설정 시 `TICKET_CHANNEL_PREFIX`(기본 `ticket-`)로 시작하는 채널에서 동작
- 봇 메시지는 무시
- 같은 유저가 같은 티켓 채널에서 연속 메시지를 보내도 `AUTO_REPLY_COOLDOWN_SEC` 동안은 1회만 자동응답

## 티켓 생성 버튼 사용법

1. 관리자 계정으로 디스코드에서 `/ticketpanel` 입력
2. 봇이 보낸 `Open a support ticket!` 버튼 클릭
3. `Startale App Smart Wallet Address`와 `Connected EOA Wallet Address`를 입력
4. 두 값을 제출하면 새 티켓 채널이 생성됨 (`ticket-유저ID`)
5. 티켓 채널 안에서 질문하면 자동응답

권장 환경변수:
- `GUILD_ID`: 명령어를 빠르게 등록하기 위해 설정
- `TICKET_CATEGORY_ID`: 생성된 티켓 채널이 들어갈 카테고리
- `SUPPORT_ROLE_ID`: 서포트팀 역할 ID (설정 시 해당 역할도 티켓 채널 접근 가능)

## AI On/Off 및 자동응답 규칙

- `AI_ENABLED=false`: 규칙 기반 자동응답만 사용
- `AI_ENABLED=true`: 규칙에 매칭되지 않는 질문에 대해 AI 응답 시도
- AI 실패 시 기본 `AUTO_REPLY_MESSAGE`로 fallback

기본 규칙:
- Soneium score portal 접속 이슈 -> score URL 안내
- wallet connection 실패 / swap / lp / deposit 이슈 -> known issue 안내
- discord role 이슈 -> role bot 지연 안내
- "아직도 fix 안됐냐"류 질문 -> still fixing 문구를 변형해서 응답
