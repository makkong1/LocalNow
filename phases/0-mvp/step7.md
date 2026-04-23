# Step 7: backend-notification

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-003: RabbitMQ, ADR-004: STOMP)
- `/backend/src/main/java/com/localnow/config/RabbitMQConfig.java`
- `/backend/src/main/java/com/localnow/infra/rabbit/RabbitPublisher.java`
- `/backend/src/main/java/com/localnow/request/service/RequestService.java`
- `/backend/src/main/java/com/localnow/match/service/MatchService.java`
- `/backend/src/main/java/com/localnow/chat/service/ChatService.java`

이전 step들에서 발행되는 RabbitMQ 라우팅 키와 payload 구조를 먼저 읽고, 어떤 이벤트를 소비해야 하는지 파악한 뒤 작업하라.

## 작업

`notification/` 도메인: RabbitMQ 메시지를 소비해 STOMP로 브라우저에 실시간 이벤트를 전달한다.
이 도메인은 별도 비즈니스 로직 없이 "메시지 라우팅"만 담당한다.

### 이벤트 소비 목록

| 라우팅 키 | 발행 위치 | 소비 후 동작 |
|-----------|-----------|-------------|
| `match.offer.created` | RequestService (요청 생성 후) | 가이드에게 `/topic/guides/{guideId}` 로 요청 알림 push |
| `match.offer.accepted` | MatchService (수락 후) | 여행자에게 `/topic/requests/{requestId}` 로 새 후보 알림 push |
| `match.confirmed` | MatchService (확정 후) | 확정된 가이드에게 `/topic/guides/{guideId}` 로 확정 알림 push |
| `chat.message.sent` | ChatService (메시지 저장 후) | 오프라인 수신자에게 `/topic/users/{userId}` 로 미수신 알림 push |

### 1. `notification/` 패키지 구조

```
notification/
├── listener/
│   ├── MatchNotificationListener.java   -- match.* 이벤트 소비
│   └── ChatNotificationListener.java    -- chat.* 이벤트 소비
└── dto/
    ├── MatchOfferCreatedEvent.java
    ├── MatchOfferAcceptedEvent.java
    ├── MatchConfirmedEvent.java
    └── ChatMessageSentEvent.java
```

### 2. `MatchNotificationListener.java`

```java
@RabbitListener(queues = "match.notification")
void handleMatchEvent(Message message) { ... }
```

라우팅 키(`message.getMessageProperties().getReceivedRoutingKey()`)로 분기:

- `match.offer.created`:
  - payload: `{ requestId, requestType, lat, lng, budgetKrw, guideIds: [Long] }`
  - `guideIds` 각각에 대해 `SimpMessagingTemplate.convertAndSendToUser` 또는 `/topic/guides/{guideId}` 로 push.
  - push payload: `{ type: "NEW_REQUEST", requestId, requestType, budgetKrw }`.

- `match.offer.accepted`:
  - payload: `{ requestId, guideId }`
  - `/topic/requests/{requestId}` 로 push.
  - push payload: `{ type: "OFFER_ACCEPTED", guideId }`.

- `match.confirmed`:
  - payload: `{ requestId, confirmedGuideId }`
  - `/topic/guides/{confirmedGuideId}` 로 push.
  - push payload: `{ type: "MATCH_CONFIRMED", requestId }`.

### 3. `ChatNotificationListener.java`

```java
@RabbitListener(queues = "chat.notification")
void handleChatEvent(Message message) { ... }
```

- `chat.message.sent`:
  - payload: `{ roomId, senderId, content }`
  - 수신자 userId를 ChatRoom에서 조회 (senderId와 반대쪽).
  - `/topic/users/{receiverId}` 로 push.
  - push payload: `{ type: "CHAT_MESSAGE", roomId, preview: content 첫 30자 }`.

### 4. `RabbitMQConfig` 보완

Step 1에서 만든 `RabbitMQConfig`에 이 step에서 필요한 Queue 바인딩이 모두 선언되어 있는지 확인.
누락된 게 있으면 추가한다.

### 5. 테스트

#### `notification/MatchNotificationIT.java` (Testcontainers RabbitMQ + WebSocket)

```java
@Test
void 매칭_제안_생성_시_가이드에게_STOMP_알림_전달() {
    // RabbitTemplate으로 match.offer.created 발행
    // STOMP 구독 중인 가이드 클라이언트가 메시지 수신하는지 확인
}
```

## Acceptance Criteria

```bash
cd backend && ./gradlew check
```

## 검증 절차

1. `./gradlew check` 실행.
2. 체크리스트:
   - RabbitMQ 리스너가 예외 발생 시 메시지를 DLQ로 보내는가? (기본 동작 확인)
   - STOMP push가 실패해도 RabbitMQ 메시지를 소비 완료(ack) 처리하는가?
   - `notification/` 패키지가 `request/`, `match/`, `chat/` 도메인 서비스를 직접 주입받지 않는가? (Repository만 허용)
3. `phases/0-mvp/index.json` step 7 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "notification 도메인(MatchNotificationListener/ChatNotificationListener) 완료. RabbitMQ→STOMP push 통합 테스트 통과. ./gradlew check 통과. 백엔드 전 도메인 구현 완료."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- `notification/` 리스너에서 `RequestService`, `MatchService`, `ChatService`를 직접 주입받지 마라. 이유: notification 도메인이 상위 도메인에 역의존하게 된다. Repository 직접 조회 또는 이벤트 payload에 필요한 정보를 포함시켜라.
- STOMP push 실패(오프라인 사용자 등)를 예외로 처리하지 마라. 이유: 연결 없는 사용자에게 push 실패는 정상이다. 로그만 찍고 메시지는 ack 처리한다.
- 기존 테스트를 깨뜨리지 마라.
