# 우선순위 기능 제안 × 코드베이스 검증

**목적:** “추가·수정할 만한 백엔드·프론트 도메인” 제안을 **저장소 실제 코드**로 검증하고, 포폴·구현 순서를 정한다.

**검증 범위:** `backend/` Java, `mobile/` RN, `pr-docs/도메인/*`, `pr-docs/frontend-web-mobile-gap-analysis.md`.

**재분석 (코드 중심):** 아래 표·불일치 항목은 `ChatController`, `ChatService`, `PaymentService`, `RedisGeoService`, `GuideController`, ` mobile/src/hooks/useChat.ts`·`useGuide.ts`, Flyway `V5__chat.sql` 등을 직접 대조해 정리했다.

---

## 0. 코드 앵커 (빠른 근거)

| 주제 | 근거 위치 |
| --- | --- |
| 채팅 메시지·브로커 | `ChatService` — STOMP `/topic/rooms/{roomId}`, Rabbit `chat.message.sent` (`publishAfterCommit`) |
| 채팅 REST | `ChatController` — `GET /requests/{requestId}/room`, `GET /rooms/{roomId}/messages` (클래스에 `@RequestMapping` 없음 → 앱 기본 서블릿 경로 그대로) |
| 채팅 스키마 | `V5__chat.sql` — `chat_rooms`, `chat_messages` (읽음 컬럼 없음) |
| 가이드 GEO | `RedisGeoService` — 키 `geo:guides`, `add` / `remove` / `radius` 만 존재 |
| 가이드 근무 API | `GuideController` `POST /guide/duty` — `onDuty=true`일 때만 lat/lng 필수 후 `addGuide` |
| 매칭 락 | `MatchService` — Redis `SET lock:request:{requestId} NX` + Lua 해제 (GEO와 **별 키**) |
| 결제 전이 | `PaymentService.capture` → `intent.capture` + `HelpRequest.toCompleted()` / `refund` → 게이트웨이 성공 시 `intent.refund()` |
| 결제 enum | `PaymentStatus.java` — 4값 고정 |
| 알림 | `ChatNotificationListener` / `MatchNotificationListener` — 큐 소비 후 `SimpMessagingTemplate` 만 (JPA 엔티티 없음) |
| 요청 생성·디스패치 | `RequestService.createRequest` — 저장 직후 `MatchDispatchEvent` ( **`startAt` 미참조** ) |
| 모바일 채팅 목록 | `useChatRooms` → **`GET /chat/rooms`** |
| 모바일 근무 토글 | `OnDutyToggle` — 켤 때 **한 번** `getCurrentPositionAsync` 후 `POST /guide/duty`, **주기 갱신 없음** |

---

## 1. 코드로 확인한 “현재 상태” 요약

| 영역 | 코드상 사실 |
| --- | --- |
| 채팅 | `chat_messages`에 읽음·last_read·unread **없음**. 히스토리는 `getHistory` → `findByRoomIdOrderBySentAtAsc`. 알림용 STOMP는 `ChatNotificationListener`가 `/topic/users/{receiverId}` 로 `CHAT_MESSAGE` preview. |
| 가이드 위치 | GEO는 TTL/heartbeat **없음**. 앱이 duty off 없이 죽으면 멤버가 **남는 구조**가 맞음. |
| 결제 | `AUTHORIZED` → `CAPTURED` → `REFUNDED` 및 `FAILED`. `PaymentService.refund`는 게이트웨이 `refund` 성공 후 **즉시** 엔티티 `refund()` — `REFUND_PENDING` 등 **없음**. |
| 알림 | 영속 테이블·REST **없음**. Rabbit → Listener → STOMP만. |
| 요청·매칭 | `HelpRequest.startAt` 필드·`CreateRequestRequest` 바인딩 **있음**. 디스패치는 **생성 직후** 고정 좌표로만 GEO 검색 (`MatchDispatcher`). |
| 요청 취소 | `HelpRequest.toCancelled()` **있음**. `RequestController`에 취소 메서드 **없음**. |
| 요청 상태 IN_PROGRESS | `toInProgress()` **호출부가 코드베이스에 없음**. 캡처 시 `PaymentService`가 `toCompleted()`만 호출 — 스키마상 상태는 있으나 **플로우상 사실상 MATCHED → COMPLETED** 에 가깝다. |
| 서비스 규모 | `MatchService` 245줄, `PaymentService` 198줄, `ChatService` 141줄 — 당장 “만 라인 신장” 수준은 아님. |

---

## 2. 정합성 이슈 (재분석에서 새로 확정)

### 2.1 모바일 `GET /chat/rooms` vs 백엔드

- 모바일 `useChatRooms` (`mobile/src/hooks/useChat.ts`)는 **`apiFetch('/chat/rooms')`** 를 호출한다.
- 백엔드 `ChatController`에는 해당 매핑이 **없다**. 존재하는 것은 `GET /requests/{requestId}/room`, `GET /rooms/{roomId}/messages` 뿐이다.
- `docs/superpowers/specs/2026-04-28-frontend-flow-design.md`에도 백엔드 존재 여부 **협의 필요**로 적혀 있다.
- **결론:** 채팅 목록 탭(`ChatListScreen`)은 UI는 있으나, **연동 완료 상태로 보기 어렵다**. 로드맵 1번(읽음) 전에 **목록 API 계약 구현** 또는 클라이언트를 기존 엔드포인트 조합으로 바꾸는 작업이 선행된다.

### 2.2 `frontend-web-mobile-gap-analysis.md` 와의 시차

- 갭 분석 문서의 “채팅 탭 플레이스홀더” 서술은 **현재 `ChatListScreen` 코드와 불일치**할 수 있다. 목록·Empty copy(“확정된 매칭이 없습니다”)까지는 구현되어 있다.
- 문서 갱신 시 **탭=목록 + 백엔드 `/chat/rooms` 공백**을 함께 적는 편이 정확하다.

---

## 3. 제안 목록별: 검증 + 공동 평가

(질문 스레드 1~14 — 가정 검증은 §1·§2로 대체하고, 여기서는 **영향·평가**만 유지·보강)

### 상 (1~5)

**1. 채팅 읽음 (`last_read_message_id`, unread, 동기화)**  
- **코드 메모:** §2.1 — 읽음 전에 **방 목록 API**를 코드와 맞출 것. `ChatRoomSummaryResponse` 필드(`lastMessagePreview` 등)는 `types/api.ts`에 정의되어 있어 백엔드 DTO와 1:1 맞춰야 함.  
- **평가:** 완성도 높음. Flyway + `ChatService` + (선택) STOMP read 이벤트 + 모바일 배지.

**2. 가이드 위치 Heartbeat + TTL**  
- **코드 메모:** 서버는 변화 없음. 모바일은 `OnDutyToggle`이 **단발 위치**만 보냄 → heartbeat는 **RN 측 주기 호출 or 백그라운드 태스크** 설계가 필수.  
- **평가:** Redis·운영 스토리에 유리 (기존 평가 유지).

**3. 결제 상태 세분화**  
- **코드 메모:** `PaymentService.refund`와 `PaymentIntent.refund()`가 동기 단계. Mock PG에 지연·재시도 시나리오를 넣기 좋음. 캡처와 동시에 `toCompleted()` — 환불 시 요청 상태 되돌림 정책은 **별도 설계** (현재 코드에 없음).  
- **평가:** 포폴 스토리 유지.

**4. Notification 저장**  
- **코드 메모:** 삽입 지점은 `*Listener` 직후 또는 Rabbit 소비 트랜잭션 분리 후 INSERT. STOMP는 유지 가능.  
- **평가:** 유지.

**5. 서비스 레이어 CQRS**  
- **코드 메모:** `ChatService`는 아직 작음. 분리 논리는 **`MatchService`·향후 알림/읽음 집계**가 커질 때 설득력 증가.  
- **평가:** 기능 몇 개 도입 뒤 리팩터가 자연스럽다.

### 중·하 (6~14)

- **6~14:** 이전 평가와 동일. **8. 예약 매칭**은 §1대로 **스케줄·디스패처 조건**이 핵심. **7. Soft delete**는 채팅·결제·감사 로그와 충돌 검토 필요.

---

## 4. 제안 목록 외 — 코드에서 추가로 짚을 갭

| 항목 | 근거 |
| --- | --- |
| **`GET /chat/rooms` 구현 또는 모바일 수정** | §2.1 — 현재 연동 불일치. |
| **요청 취소 REST** | `toCancelled()`만 존재, API 없음. |
| **`IN_PROGRESS` 사용 여부 결정** | 호출부 없음. 제거·문서화·“서비스 시작” API 중 택일. |
| **`start_at` 정책 명시** | 필드만 있고 매칭 타이밍에 미반영. |

---

## 5. 추천 순서 (코드 검증 반영판)

질문자 우선 **2 → 4 → 3** 은 여전히 타당하다. 다만 **채팅 관련**은 아래를 최상위 “수습”으로 둔다.

**실행 순서 제안**

0. **선행:** `GET /chat/rooms` 백엔드 추가(또는 모바일을 기존 API로 변경) — 그렇지 않으면 1번·채팅 탭 검증이 불가능하다.  
1. **2 — GEO heartbeat/TTL** (서버 TTL/보조키 + RN 주기 duty)  
2. **4 — notification 테이블 + API**  
3. **3 — 결제 상태 세분화** (+ 필요 시 요청 상태와 환불 정책)  
4. **1 — 채팅 읽음** (0 완료 후)  
5. **5 — 서비스 경계 정리**  
6. **빠른 승리:** 요청 취소 REST + UI, `IN_PROGRESS` 용도 정리

---

## 6. `pr-docs`·문서 참고

- 도메인: `pr-docs/도메인/backend-chat.md`, `backend-payment.md`, `backend-notification.md`  
- 프론트 갭: `pr-docs/frontend-web-mobile-gap-analysis.md` (**§2.2 시차 주의**)  
- 인프라: `pr-docs/Redis-RabbitMQ.md`

---

_구현 시 `docs/API_CONVENTIONS.md`·`docs/ADR.md` 동기화 권장._
