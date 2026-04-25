# Step 11: web-chat

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (WebSocket 프록시 섹션)
- `/docs/API_CONVENTIONS.md` (WebSocket STOMP 채널 규약)
- `/docs/UI_GUIDE.md` (실시간 연결 인디케이터 섹션)
- `/web/src/types/api.ts`
- `/web/src/app/traveler/page.tsx`
- `/web/src/app/guide/page.tsx`
- `/web/src/app/api/requests/[id]/room/route.ts`

이전 step에서 만들어진 여행자/가이드 뷰와 Route Handler 스텁을 읽고, ChatPanel을 어디에 통합할지 파악한 뒤 작업하라.

## 작업

`ChatPanel` 컴포넌트와 STOMP 클라이언트를 구현하고, 여행자/가이드 뷰에 통합한다.
이 step에서 실시간 채팅 + 실시간 이벤트 알림(수락 알림, 확정 알림)까지 완성된다.

### 1. Route Handler 완성

#### `app/api/requests/[id]/room/route.ts`
- `GET`: 백엔드 `GET /requests/{id}/room` 프록시.

#### `app/api/rooms/[id]/messages/route.ts`
- `GET`: 백엔드 `GET /rooms/{id}/messages` 프록시.

#### `app/api/chat/socket-token/route.ts`
- `GET`: 쿠키에서 `auth_token` 읽어 그대로 반환. `{ token: string }`.
- STOMP 연결 시 브라우저가 이 엔드포인트를 먼저 호출해 토큰을 받고, STOMP 핸드셰이크 헤더에 사용한다.
- 이렇게 하면 환경변수 `BACKEND_BASE_URL`이 브라우저에 노출되지 않는다.

### 2. `web/src/lib/stomp-client.ts`

브라우저 전용 (`"client-only"` import 추가). STOMP.js + SockJS를 사용.

```typescript
type MessageHandler = (body: unknown) => void;

class StompClient {
  connect(token: string): Promise<void>;
  disconnect(): void;
  subscribe(destination: string, handler: MessageHandler): () => void;  // unsubscribe 반환
  send(destination: string, body: unknown): void;
  get connectionState(): 'connecting' | 'connected' | 'disconnected';
}
```

구현 규칙:
- 연결 URL: 백엔드 WebSocket 엔드포인트. 브라우저에서 환경변수를 직접 읽을 수 없으므로, `NEXT_PUBLIC_WS_URL` 환경변수를 사용한다 (WebSocket URL만 공개 허용 — 인증은 토큰으로 분리).
- SockJS → STOMP 핸드셰이크 시 `Authorization: Bearer {token}` 헤더 포함.
- 연결 끊기면 5초 후 자동 재연결 (최대 3회).
- singleton 패턴 금지. 탭/컴포넌트별 인스턴스 사용 (ADR-010).

### 3. Client Component: `components/client/ChatPanel.tsx`

```typescript
interface ChatPanelProps {
  roomId: number;
  currentUserId: number;
}
```

UI 구성:
- 상단: 연결 상태 인디케이터 (UI_GUIDE.md 규칙: 점 + 텍스트).
- 중간: 메시지 스크롤 영역.
  - 내 메시지: 우측 정렬, amber tint 배경.
  - 상대 메시지: 좌측 정렬, neutral-800 배경.
  - 시간: `text-xs text-neutral-500 tabular-nums`.
  - 새 메시지 도착 시 자동 스크롤 다운.
- 하단: 텍스트 입력 + 전송 버튼.

동작:
1. 마운트 시 `GET /api/rooms/{roomId}/messages`로 히스토리 로드.
2. `GET /api/chat/socket-token`으로 토큰 취득.
3. `StompClient.connect(token)`.
4. `/topic/rooms/{roomId}` 구독 → 수신 메시지를 상태에 추가.
5. 전송: `clientMessageId`(UUID v4 생성) + `content` → `StompClient.send("/app/rooms/{roomId}/messages", payload)`.
6. 언마운트 시 구독 해제 + `StompClient.disconnect()`.
7. 재연결 중 메시지 입력은 가능하지만 전송 버튼은 disabled.

### 4. 실시간 알림 구독 (가이드/여행자 공통)

`components/client/RealtimeProvider.tsx` ("use client"):
- `StompClient`로 `/topic/guides/{userId}` 또는 `/topic/requests/{requestId}` 구독.
- `StompEvent` 타입(`types/api.ts`)으로 이벤트 수신.
- 이벤트별 처리:
  - `NEW_REQUEST` (가이드): TanStack Query `invalidateQueries(['nearbyRequests'])` → Step 10의 폴링 교체.
  - `OFFER_ACCEPTED` (여행자): `invalidateQueries(['offers', requestId])`.
  - `MATCH_CONFIRMED` (가이드): 알림 토스트 표시 (`"매칭이 확정되었습니다"`).
  - `CHAT_MESSAGE`: `invalidateQueries(['chatRoom'])`.
- 각 페이지의 최상단 Client 컴포넌트에 `<RealtimeProvider>`를 감싼다.

### 5. 여행자/가이드 뷰 통합

#### `app/traveler/page.tsx` 업데이트
- `HelpRequest.status === 'MATCHED'` 이상이면 `<ChatPanel roomId={room.id} currentUserId={userId} />` 표시.
- `<RealtimeProvider userId={userId} activeRequestId={activeRequest?.id} />` 추가.

#### `app/guide/page.tsx` 업데이트
- 확정된 매칭이 있으면 `<ChatPanel>` 표시.
- `<RealtimeProvider userId={userId} />` 추가. `NEW_REQUEST` 이벤트를 받으면 Step 10의 폴링을 대체 (refetchInterval 제거).

### 6. `web/.env.local` 문서화

`.env.local` 파일에 필요한 변수 목록을 주석으로 문서화한 `.env.local.example`을 커밋한다:
```
BACKEND_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=http://localhost:8080/ws
```
`.env.local` 자체는 gitignore 대상이므로 커밋하지 않는다.

### 7. 테스트

`components/client/__tests__/ChatPanel.test.tsx` (Vitest + RTL):
- 렌더 시 히스토리 fetch 호출 확인
- 전송 버튼 클릭 → `StompClient.send` 호출 (`clientMessageId` UUID 포함)
- 연결 상태 `disconnected`이면 전송 버튼 disabled

## Acceptance Criteria

```bash
cd web && npm run lint && npm run build
```

## 검증 절차

1. `npm run lint && npm run build` 실행.
2. 체크리스트:
   - `stomp-client.ts`에 `"client-only"` import가 있어 서버에서 import 시 에러 발생하는가?
   - `ChatPanel` 언마운트 시 STOMP 구독이 해제되는가? (메모리 누수 방지)
   - `clientMessageId`가 매 전송마다 새 UUID v4로 생성되는가?
   - `NEXT_PUBLIC_WS_URL` 외에 백엔드 내부 URL이 브라우저 번들에 노출되지 않는가?
   - UI_GUIDE.md 연결 인디케이터 규칙(점 + 텍스트, animate-pulse)을 따르는가?
3. 최종 시연 시나리오 수동 검증 (가능하면):
   - 탭 A(여행자), 탭 B(가이드)를 열고 README.md의 시연 시나리오를 따라 매칭 → 채팅이 실시간으로 동작하는지 확인.
4. `phases/0-mvp/index.json` step 11 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "ChatPanel(STOMP.js/SockJS 실시간 채팅) + stomp-client.ts + RealtimeProvider(이벤트 구독) + 여행자/가이드 뷰 통합 완료. MVP 전 구현 완성. npm run build 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- `StompClient`를 모듈 레벨 싱글톤으로 만들지 마라. 이유: 탭 간 상태가 공유되어 구독이 뒤섞인다 (ADR-010).
- `stomp-client.ts`를 Server Component에서 import하지 마라. 이유: STOMP.js는 브라우저 전용(`window` 참조). `"client-only"`로 보호한다.
- `.env.local`을 커밋하지 마라. 이유: BACKEND_BASE_URL 등 내부 설정이 노출된다. `.env.local.example`만 커밋한다.
- 기존 테스트를 깨뜨리지 마라.
