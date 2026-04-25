# Step 5: backend-chat

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-004: STOMP, ADR-003: RabbitMQ AFTER_COMMIT)
- `/docs/API_CONVENTIONS.md` (WebSocket 채널 규약 섹션)
- `/backend/src/main/java/com/localnow/config/WebSocketConfig.java`
- `/backend/src/main/java/com/localnow/config/JwtProvider.java`
- `/backend/src/main/java/com/localnow/infra/rabbit/RabbitPublisher.java`
- `/backend/src/main/java/com/localnow/match/domain/MatchOffer.java`

이전 step에서 만들어진 WebSocketConfig 스텁과 MatchOffer를 먼저 읽고, 채팅방이 어떻게 개설되는지 파악한 뒤 작업하라.

## 작업

`chat/` 도메인: 매칭 확정 시 채팅방이 생성되고, 참여자만 STOMP로 메시지를 송수신한다.

### 1. DB 마이그레이션 `V5__chat.sql`

```sql
CREATE TABLE chat_rooms (
    id         BIGINT  NOT NULL AUTO_INCREMENT,
    request_id BIGINT  NOT NULL UNIQUE,
    traveler_id BIGINT NOT NULL,
    guide_id   BIGINT  NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    FOREIGN KEY (request_id)  REFERENCES help_requests(id),
    FOREIGN KEY (traveler_id) REFERENCES users(id),
    FOREIGN KEY (guide_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_messages (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    room_id           BIGINT       NOT NULL,
    sender_id         BIGINT       NOT NULL,
    content           TEXT         NOT NULL,
    client_message_id VARCHAR(36)  NOT NULL,  -- UUID v4 멱등키
    sent_at           DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_chat_message_idempotent (room_id, sender_id, client_message_id),
    FOREIGN KEY (room_id)   REFERENCES chat_rooms(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, sent_at);
```

### 2. 도메인 엔티티

- `chat/domain/ChatRoom.java`: 위 테이블과 1:1 매핑.
- `chat/domain/ChatMessage.java`: 위 테이블과 1:1 매핑.

### 3. `chat/repository/`

- `ChatRoomRepository`: `Optional<ChatRoom> findByRequestId(Long requestId)`
- `ChatMessageRepository`: `List<ChatMessage> findByRoomIdOrderBySentAtAsc(Long roomId)`

### 4. `chat/dto/`

API_CONVENTIONS.md의 WebSocket 채널 규약과 1:1 대응:
- `ChatMessageRequest`: `content`, `clientMessageId`(UUID 문자열).
- `ChatMessageResponse`: `messageId`, `roomId`, `senderId`, `content`, `sentAt`, `clientMessageId`.
- `ChatRoomResponse`: `id`, `requestId`, `travelerId`, `guideId`, `createdAt`.

### 5. `chat/service/ChatService.java`

```java
ChatRoom createRoom(Long requestId, Long travelerId, Long guideId);   // 매칭 확정 시 호출
ChatMessageResponse sendMessage(Long roomId, Long senderId, ChatMessageRequest req);
List<ChatMessageResponse> getHistory(Long roomId, Long requesterId);
ChatRoomResponse getRoom(Long requestId, Long requesterId);
```

`sendMessage` 규칙:
1. `clientMessageId`로 이미 저장된 메시지가 있으면 기존 메시지를 반환 (멱등).
2. 새 메시지 저장.
3. `SimpMessagingTemplate.convertAndSend("/topic/rooms/{roomId}", ChatMessageResponse)` 으로 브로드캐스트.
4. AFTER_COMMIT: 수신자(senderId가 아닌 쪽)가 오프라인이면 `RabbitPublisher.publish("chat.message.sent", { roomId, senderId, content })`.

방 접근 권한: `requesterId`가 `travelerId` 또는 `guideId`가 아니면 `AUTH_FORBIDDEN(403)`.

`createRoom`은 `match/service/MatchService.confirm` 성공 직후 호출한다.
→ 구체적으로: Step 4의 `MatchService.confirm` 안에서 AFTER_COMMIT 이벤트로 `ChatService.createRoom`을 호출하거나,
  MatchService에서 직접 `ChatService.createRoom`을 호출해도 된다. 단, 트랜잭션 경계 안에서 ChatRoom이 생성되어야 한다.

### 6. `chat/controller/ChatController.java` (HTTP)

| HTTP | Path | 설명 |
|------|------|------|
| GET  | `/requests/{requestId}/room` | 채팅방 정보 조회 |
| GET  | `/rooms/{roomId}/messages`   | 메시지 히스토리 |

### 7. `chat/controller/StompChatController.java` (STOMP)

```java
@MessageMapping("/rooms/{roomId}/messages")
// → ChatService.sendMessage 호출
// → SimpMessagingTemplate로 /topic/rooms/{roomId} 브로드캐스트
```

### 8. `config/ChatChannelInterceptor.java` (ChannelInterceptor 완성)

Step 1에서 스텁으로 남겨뒀던 `ChannelInterceptor`를 이 step에서 완성한다.
- SUBSCRIBE 커맨드: destination이 `/topic/rooms/{roomId}` 형태일 때, 헤더의 JWT를 검증하고 해당 방의 참여자인지 확인. 아니면 `MessagingException` throw.
- WebSocketConfig에 이 인터셉터를 등록.

### 9. 테스트

#### `chat/service/ChatServiceTest.java` (단위, Mockito)

- 정상: sendMessage → clientMessageId 중복 시 멱등 반환
- 예외: 방 참여자가 아닌 사용자가 getHistory → AUTH_FORBIDDEN

#### `chat/ChatFlowIT.java` (Testcontainers MySQL + WebSocket)

```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
// STOMP 클라이언트 두 개(여행자, 가이드)로 /topic/rooms/{roomId} 구독 후
// 메시지 전송 → 양쪽에서 수신 확인
```

## Acceptance Criteria

```bash
cd backend && ./gradlew check
```

## 검증 절차

1. `./gradlew check` 실행.
2. 체크리스트:
   - `clientMessageId` 중복 저장이 DB UNIQUE 제약으로 막히는가?
   - SUBSCRIBE 권한 체크가 `ChannelInterceptor`에서 이루어지는가?
   - STOMP 메시지 처리 후 RabbitMQ 발행이 `AFTER_COMMIT`으로 이루어지는가?
3. `phases/0-mvp/index.json` step 5 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "chat 도메인(ChatRoom/ChatMessage/ChatService/StompChatController/ChannelInterceptor) + V5__chat.sql 완료. STOMP 통합 테스트 통과. ./gradlew check 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- `clientMessageId` 중복 체크를 DB UNIQUE 제약 없이 서비스 레이어 조회만으로 처리하지 마라. 이유: 동시 요청 시 레이스 컨디션이 생긴다.
- SUBSCRIBE 권한 체크를 `StompChatController` 안에서 하지 마라. 이유: 구독 시점에 ChannelInterceptor에서 끊어야 한다. 컨트롤러는 이미 구독이 허용된 후에 실행된다.
- `SimpMessagingTemplate`으로 브로드캐스트한 후에도 RabbitMQ 발행을 BEFORE_COMMIT으로 하지 마라. 이유: 트랜잭션 롤백 시 유령 이벤트.
- 기존 테스트를 깨뜨리지 마라.
