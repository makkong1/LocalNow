# Step 1: chat-rooms-backend

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/Users/maknkkong/project/localNow/CLAUDE.md`
- `/Users/maknkkong/project/localNow/docs/API_CONVENTIONS.md`
- `/Users/maknkkong/project/localNow/docs/ARCHITECTURE.md`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/chat/controller/ChatController.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/chat/service/ChatService.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/chat/domain/ChatRoom.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/chat/repository/ChatRoomRepository.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/chat/repository/ChatMessageRepository.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/user/domain/User.java`
- `/Users/maknkkong/project/localNow/mobile/src/types/api.ts` (ChatRoomSummaryResponse 확인용)

이전 step 0에서 수정된 파일:
- `/Users/maknkkong/project/localNow/mobile/src/screens/ChatListScreen.tsx`

## 배경

모바일 `ChatListScreen`은 `GET /chat/rooms`를 호출하지만 백엔드에 해당 엔드포인트가 없다. 모바일이 기대하는 응답 타입(`ChatRoomSummaryResponse`)은 단순 `ChatRoomResponse`와 달리 파트너 이름, 마지막 메시지, 요청 타입을 포함해야 하므로 3-way JOIN이 필요하다.

모바일 `types/api.ts`의 `ChatRoomSummaryResponse` 계약:
```typescript
interface ChatRoomSummaryResponse {
  roomId: number;
  requestId: number;
  requestType: RequestType;       // help_requests.request_type
  partnerName: string;            // users.name (상대방)
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
}
```

## 작업

### 1. DTO 생성

`backend/src/main/java/com/localnow/chat/dto/ChatRoomSummaryResponse.java`

```java
public record ChatRoomSummaryResponse(
    Long roomId,
    Long requestId,
    String requestType,
    String partnerName,
    String lastMessagePreview,
    LocalDateTime lastMessageAt
) {}
```

### 2. Repository 확장

`ChatRoomRepository`에 현재 사용자가 참여한 방 목록을 조회하는 메서드를 추가한다.

```java
// ChatRoomRepository.java
List<ChatRoom> findByTravelerIdOrGuideIdOrderByIdDesc(Long travelerId, Long guideId);
```

`ChatMessageRepository`에 방별 마지막 메시지를 조회하는 메서드를 추가한다.

```java
// ChatMessageRepository.java
Optional<ChatMessage> findTopByRoomIdOrderBySentAtDesc(Long roomId);
```

### 3. ChatService 메서드 추가

```java
// ChatService.java
@Transactional(readOnly = true)
public List<ChatRoomSummaryResponse> getRoomsForUser(@NonNull Long userId) { ... }
```

구현 로직:
1. `findByTravelerIdOrGuideIdOrderByIdDesc(userId, userId)`로 방 목록 조회
2. 방마다 `requestId`로 `HelpRequestRepository`에서 `requestType` 조회
3. 방마다 상대방 userId(`travelerId == userId ? guideId : travelerId`)로 `UserRepository`에서 `name` 조회
4. 방마다 `findTopByRoomIdOrderBySentAtDesc`로 마지막 메시지 조회
5. `ChatRoomSummaryResponse`로 매핑 후 반환

N+1 주의: 방이 많아질 경우 성능 문제가 있으나, MVP 단계이므로 단순 루프 구현을 허용한다. 단, 향후 개선을 위해 TODO 주석을 남겨라.

### 4. ChatController 엔드포인트 추가 및 경로 정리

`ChatController`에 `@RequestMapping("/chat")`을 추가하고 기존 엔드포인트 경로를 조정한다.

```java
@RestController
@RequestMapping("/chat")
public class ChatController {

    // GET /chat/rooms — 신규
    @GetMapping("/rooms")
    public ResponseEntity<ApiResponse<List<ChatRoomSummaryResponse>>> getRooms(
            Authentication authentication) { ... }

    // GET /chat/requests/{requestId}/room — 경로 변경 (기존: /requests/{requestId}/room)
    @GetMapping("/requests/{requestId}/room")
    public ResponseEntity<ApiResponse<ChatRoomResponse>> getRoom(...) { ... }

    // GET /chat/rooms/{roomId}/messages — 경로 변경 (기존: /rooms/{roomId}/messages)
    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<ApiResponse<List<ChatMessageResponse>>> getHistory(...) { ... }
}
```

**중요:** 기존 경로(`/requests/{requestId}/room`, `/rooms/{roomId}/messages`)가 변경되므로 모바일 `useChat.ts`의 호출 경로도 함께 수정해야 한다:
- `useChatRoom`: `/requests/${requestId}/room` → `/chat/requests/${requestId}/room`
- `useMessages`: `/rooms/${roomId}/messages` → `/chat/rooms/${roomId}/messages`

### 5. 테스트 작성

`backend/src/test/java/com/localnow/chat/service/ChatServiceTest.java` (없으면 신규 생성)에 아래를 추가한다:

- `getRoomsForUser` — 여행자 입장에서 방 목록과 파트너 이름이 올바르게 반환되는지 확인
- `getRoomsForUser` — 가이드 입장에서 방 목록과 파트너 이름이 올바르게 반환되는지 확인
- `getRoomsForUser` — 마지막 메시지가 없는 방은 `lastMessagePreview`가 null인지 확인

## Acceptance Criteria

```bash
cd /Users/maknkkong/project/localNow/backend
./gradlew test --tests "com.localnow.chat.*"

cd /Users/maknkkong/project/localNow/mobile
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - `GET /chat/rooms` 엔드포인트가 존재하며 `ChatRoomSummaryResponse` 리스트를 반환하는가?
   - 기존 `getRoom`, `getHistory` 엔드포인트가 새 경로(`/chat/requests/...`, `/chat/rooms/...`)에서 동작하는가?
   - 모바일 `useChat.ts` 호출 경로가 새 경로와 일치하는가?
   - CLAUDE.md: 컨트롤러가 Repository를 직접 호출하지 않는가?
   - CLAUDE.md: DTO와 엔티티가 분리되어 있는가?
3. 결과에 따라 `phases/5-chat-gaps/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "GET /chat/rooms 구현 완료, ChatController @RequestMapping('/chat') 경로 정리, mobile useChat.ts 경로 동기화"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- 컨트롤러에서 `ChatRoomRepository`, `ChatMessageRepository`를 직접 주입하지 마라. 이유: CLAUDE.md CRITICAL — 비즈니스 로직은 service 계층에서 처리한다.
- `ChatRoomSummaryResponse` 타입을 `types/api.ts` 외의 모바일 파일에 재정의하지 마라. 이유: CLAUDE.md CRITICAL — API 타입은 types/api.ts에서만 정의한다.
- 기존 테스트를 깨뜨리지 마라.
