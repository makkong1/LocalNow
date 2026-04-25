# Step 5: chat-realtime

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (데이터 흐름 — 채팅, 실시간 알림 섹션)
- `/docs/ADR.md` (ADR-004: STOMP 내장 브로커, ADR-013: Native WebSocket)
- `/docs/API_CONVENTIONS.md`
- `/backend/src/main/java/com/localnow/config/WebSocketConfig.java`
- `/backend/src/main/java/com/localnow/config/ChatChannelInterceptor.java`
- `/backend/src/main/java/com/localnow/notification/listener/MatchNotificationListener.java`
- `/backend/src/main/java/com/localnow/notification/listener/ChatNotificationListener.java`
- `/mobile/src/types/api.ts` (StompEvent 타입)
- `/mobile/src/hooks/useChat.ts`

## 작업

STOMP over Native WebSocket 으로 실시간 채팅과 알림을 구현한다.

### 1. `mobile/src/lib/stomp-client.ts`

Native WebSocket 기반 STOMP 클라이언트:
```typescript
interface StompClientOptions {
  url: string;          // ws://host/ws-native
  token: string;        // JWT — CONNECT 시 헤더로 전달
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
}

class LocalNowStompClient {
  connect(options: StompClientOptions): void
  disconnect(): void
  subscribe(destination: string, callback: (body: string) => void): StompSubscription
  send(destination: string, body: unknown): void
  get isConnected(): boolean
}
export const stompClient = new LocalNowStompClient();
```

구현 주의사항:
- `@stomp/stompjs` 의 `Client` 사용. `webSocketFactory: () => new WebSocket(url)`.
- STOMP CONNECT 시 헤더: `{ Authorization: 'Bearer ' + token }`.
- `reconnectDelay: 5000` 설정. 자동 재연결 활성화.
- React Native 에서 `global.WebSocket` 이 기본 제공되므로 폴리필 불필요.

### 2. `mobile/src/hooks/useRealtime.ts`

앱 전체 실시간 이벤트 구독 관리:
```typescript
function useRealtime(userId: number, role: UserRole): {
  isConnected: boolean;
}
```
실제 signature 는 활성 요청 토픽 구독을 위해 아래 형태로 구현한다:
```typescript
function useRealtime(params: {
  userId: number;
  role: UserRole;
  activeRequestId?: number;
}): { isConnected: boolean }
```
- 마운트 시 `stompClient.connect()`. 언마운트 시 `stompClient.disconnect()`.
- 구독 채널:
  - `/topic/users/{userId}` → `CHAT_MESSAGE` 이벤트 → `queryClient.invalidateQueries(['messages', roomId])`
  - 역할이 GUIDE 이면 `/topic/guides/{userId}` → `NEW_REQUEST` 이벤트 → `queryClient.invalidateQueries(['openRequests'])`
  - 역할이 TRAVELER 이고 `activeRequestId` 가 있으면 `/topic/requests/{activeRequestId}` → `OFFER_ACCEPTED` 이벤트 → `queryClient.invalidateQueries(['offers', activeRequestId])`
  - `/topic/guides/{userId}` → `MATCH_CONFIRMED` → Alert 알림 + `queryClient.invalidateQueries(['myRequests'])`
- `isConnected` 상태를 반환하여 헤더에 연결 상태 표시.

`AppNavigator.tsx` 에서 `useRealtime({ userId, role, activeRequestId })` 을 호출해 앱 진입 후 한 번 연결한다.
`activeRequestId` 는 `useMyRequests()` 의 최신 활성 요청 또는 GuideScreen 에서 수락/확정된 요청 ID 로 계산한다.

### 3. `mobile/src/screens/ChatScreen.tsx`

완성 구현:
```typescript
interface ChatScreenProps {
  route: { params: { roomId: number; requestId: number } }
}
```
- `useMessages(roomId)` 로 메시지 히스토리 로드.
- STOMP 구독 `/topic/rooms/{roomId}` 로 실시간 메시지 수신. 수신 시 메시지 목록에 즉시 추가.
- 메시지 전송: STOMP `SEND /app/rooms/{roomId}/messages` 로 발행. `clientMessageId` 는 `react-native-uuid` 로 v4 값을 생성한다 (멱등 체크용).
- 메시지 목록은 `FlatList` 로 렌더. 새 메시지 수신 시 자동 스크롤.
- 연결 상태 인디케이터 표시 (connected / reconnecting).

### 4. `mobile/src/components/ChatBubble.tsx`

```typescript
interface ChatBubbleProps {
  message: ChatMessageResponse;
  isMine: boolean;
}
```
- 내 메시지 → 오른쪽 정렬, primary(amber) 배경.
- 상대 메시지 → 왼쪽 정렬, surface 배경.
- 발신 시각 (`sentAt`) 표시.

### 5. `TravelerScreen` / `GuideScreen` 연동

- `AppNavigator` 의 Chat 탭에 `ChatScreen` 을 등록하되, 실제 채팅방이 선택되지 않은 경우 안내 화면을 보여준다.
- 매칭 확정(`MATCH_CONFIRMED` 이벤트 또는 상태 전환) 시 자동으로 Chat 탭 포커스.
- `TravelerScreen` 의 MATCHED 상태에서 "채팅 열기" 버튼 → `navigation.navigate('Chat', { roomId, requestId })`.
- `GuideScreen` 의 확정된 요청에서 동일하게 연결.
- Bottom Tab 안에서 route params 전달이 복잡해지면 `AppNavigator` 를 Root Stack + Bottom Tab 구조로 바꿔 `ChatScreen` 을 Stack 화면으로 올린다. 이 경우 Chat 탭은 "최근 채팅" 안내 화면만 담당한다.

### 6. 테스트

`mobile/src/__tests__/ChatBubble.test.tsx`:
- `isMine: true` 일 때 amber 배경 스타일이 적용된다.
- 발신 시각이 렌더된다.

`mobile/src/__tests__/stomp-client.test.ts` (mock):
- `connect()` 호출 시 WebSocket 이 생성된다.
- `disconnect()` 호출 시 STOMP 연결이 해제된다.

## Acceptance Criteria

```bash
cd mobile && npm test     # ChatBubble, stomp-client 테스트 포함 전체 통과
cd mobile && npm run lint # 에러 0
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - STOMP 연결이 SockJS 없이 순수 WebSocket 으로 이루어지는가? (`/ws-native` 엔드포인트)
- `clientMessageId` 가 `react-native-uuid` 로 생성되어 중복 전송 방지가 되는가?
   - `useRealtime` 이 언마운트 시 STOMP 연결을 해제하는가 (메모리 누수 방지)?
- `useRealtime` 이 `activeRequestId` 변경 시 기존 request topic 구독을 정리하고 새 topic 을 구독하는가?
3. 시뮬레이터에서 수동 검증 (선택):
   - iOS/Android 시뮬레이터 두 개에서 각각 여행자/가이드로 로그인 → 요청 생성 → 수락 → 확정 → 채팅 메시지 교환이 실시간으로 동작하는가?
4. `phases/1-mobile-app/index.json` step 5 업데이트.

## 금지사항

- `SockJS` 를 import 하지 마라. 이유: React Native 환경에서 작동하지 않고, Native WebSocket 으로 충분하다 (ADR-013).
- `stompClient` 를 컴포넌트 내부에서 직접 생성하지 마라. 이유: 싱글톤 패턴으로 연결을 재사용해야 한다. `lib/stomp-client.ts` 의 인스턴스만 사용.
- 채팅 메시지를 DB 거치지 않고 STOMP 만으로 전달하려 하지 마라. 이유: 오프라인 상대를 위해 백엔드가 DB 에 저장하고 RabbitMQ 로 전달한다. 클라이언트는 STOMP 구독만 한다.
- 기존 `web/` 의 stomp-client.ts 나 RealtimeProvider 를 수정하지 마라.
