# 우선순위 기능 제안 × 코드베이스 검증

**목적:** "추가·수정할 만한 백엔드·프론트 도메인" 제안을 **저장소 실제 코드**로 검증하고, 포폴·구현 순서를 정한다.

**검증 범위:** `backend/` Java, `mobile/` RN, `pr-docs/도메인/*`, `pr-docs/frontend-web-mobile-gap-analysis.md`.

**재분석 (코드 중심):** 아래 표·불일치 항목은 `ChatController`, `ChatService`, `PaymentService`, `RedisGeoService`, `GuideController`, ` mobile/src/hooks/useChat.ts`·`useGuide.ts`, Flyway `V5__chat.sql` 등을 직접 대조해 정리했다.

---

## 0. 코드 앵커 (빠른 근거)

| 주제               | 근거 위치                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 채팅 메시지·브로커 | `ChatService` — STOMP `/topic/rooms/{roomId}`, Rabbit `chat.message.sent` (`publishAfterCommit`)                                                   |
| 채팅 REST          | `ChatController` — `GET /requests/{requestId}/room`, `GET /rooms/{roomId}/messages` (클래스에 `@RequestMapping` 없음 → 앱 기본 서블릿 경로 그대로) |
| 채팅 스키마        | `V5__chat.sql` — `chat_rooms`, `chat_messages` (읽음 컬럼 없음)                                                                                    |
| 가이드 GEO         | `RedisGeoService` — 키 `geo:guides`, `add` / `remove` / `radius` 만 존재                                                                           |
| 가이드 근무 API    | `GuideController` `POST /guide/duty` — `onDuty=true`일 때만 lat/lng 필수 후 `addGuide`                                                             |
| 매칭 락            | `MatchService` — Redis `SET lock:request:{requestId} NX` + Lua 해제 (GEO와 **별 키**)                                                              |
| 결제 전이          | `PaymentService.capture` → `intent.capture` + `HelpRequest.toCompleted()` / `refund` → 게이트웨이 성공 시 `intent.refund()`                        |
| 결제 enum          | `PaymentStatus.java` — 4값 고정                                                                                                                    |
| 알림               | `ChatNotificationListener` / `MatchNotificationListener` — 큐 소비 후 `SimpMessagingTemplate` 만 (JPA 엔티티 없음)                                 |
| 요청 생성·디스패치 | `RequestService.createRequest` — 저장 직후 `MatchDispatchEvent` ( **`startAt` 미참조** )                                                           |
| 모바일 채팅 목록   | `useChatRooms` → **`GET /chat/rooms`**                                                                                                             |
| 모바일 근무 토글   | `OnDutyToggle` — 켤 때 **한 번** `getCurrentPositionAsync` 후 `POST /guide/duty`, **주기 갱신 없음**                                               |

---

## 1. 코드로 확인한 "현재 상태" 요약

| 영역                  | 코드상 사실                                                                                                                                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 채팅                  | `chat_messages`에 읽음·last_read·unread **없음**. 히스토리는 `getHistory` → `findByRoomIdOrderBySentAtAsc`. 알림용 STOMP는 `ChatNotificationListener`가 `/topic/users/{receiverId}` 로 `CHAT_MESSAGE` preview.                                                                                                       |
| 가이드 위치           | GEO는 TTL/heartbeat **없음**. 앱이 duty off 없이 죽으면 멤버가 **남는 구조**가 맞음.                                                                                                                                                                                                                                 |
| 결제                  | `AUTHORIZED` → `CAPTURED` → `REFUNDED` 및 `FAILED`. `PaymentService.refund`는 게이트웨이 `refund` 성공 후 **즉시** 엔티티 `refund()` — `REFUND_PENDING` 등 **없음**.                                                                                                                                                 |
| 알림                  | 영속 테이블·REST **없음**. Rabbit → Listener → STOMP만.                                                                                                                                                                                                                                                              |
| 요청·매칭             | `HelpRequest.startAt` 필드·`CreateRequestRequest` 바인딩 **있음**. 디스패치는 **생성 직후** 고정 좌표로만 GEO 검색 (`MatchDispatcher`).                                                                                                                                                                              |
| 요청 취소             | `HelpRequest.toCancelled()` **있음**. `RequestController`에 취소 메서드 **없음**.                                                                                                                                                                                                                                    |
| 요청 상태 IN_PROGRESS | `toInProgress()` **호출부가 코드베이스에 없음**. 캡처 시 `PaymentService`가 `toCompleted()`만 호출 — 스키마상 상태는 있으나 **플로우상 사실상 MATCHED → COMPLETED** 에 가깝다. 단, `toCompleted()` 가드가 `IN_PROGRESS`와 `MATCHED` 둘 다 허용하므로 나중에 `IN_PROGRESS` 진입로를 추가해도 기존 흐름을 깨지 않는다. |
| 서비스 규모           | `MatchService` 245줄, `PaymentService` 198줄, `ChatService` 141줄 — 당장 "만 라인 신장" 수준은 아님.                                                                                                                                                                                                                 |

---

## 2. 정합성 이슈 (재분석에서 새로 확정)

### 2.1 모바일 `GET /chat/rooms` vs 백엔드 ✅ 해결 (5-chat-gaps step 1)

- **구현 완료:** `ChatController`에 `@RequestMapping("/chat")`을 추가하고 `GET /chat/rooms` 구현. `ChatService.getRoomsForUser()` + `ChatRoomSummaryResponse` DTO (3-way JOIN).
- 기존 경로 통합: `GET /requests/{requestId}/room` → `GET /chat/requests/{requestId}/room`, `GET /rooms/{roomId}/messages` → `GET /chat/rooms/{roomId}/messages`.
- `mobile/src/hooks/useChat.ts`의 `apiFetch('/chat/rooms')` 호출과 계약 일치. `API_CONVENTIONS.md` 채팅 섹션 동기화 완료.

### 2.2 `ChatListScreen` 오류 침묵 버그 ✅ 해결 (5-chat-gaps step 0)

`isError` 분기와 재시도 버튼 추가 완료. API 오류와 빈 목록이 분리되어 표시된다.

### 2.3 `frontend-web-mobile-gap-analysis.md` 와의 시차

- `/chat/rooms` 구현 및 경로 통합으로 채팅 탭 백엔드 연동이 완료됐다.
- 갭 분석 문서에 **경로 변경(`/rooms/*` → `/chat/rooms/*`, `/requests/*/room` → `/chat/requests/*/room`)** 을 반영하면 최신 상태가 된다.

---

## 3. 코드 직접 대조에서 새로 발견한 버그·구조 이슈

### 3.1 `PaymentService.createIntent()` — PG 이중 호출 경쟁 조건 🔴 (실 PG 연동 전 블로커)

```java
// PaymentService.java — createIntent()
var existing = paymentIntentRepository.findByIdempotencyKey(idempotencyKey);
if (existing.isPresent()) return toResponse(existing.get());
// ↑ 동시 요청 A, B 모두 empty를 확인하고 아래로 진입

PaymentGateway.AuthResult auth = paymentGateway.authorize(amountKrw, idempotencyKey);
// ↑ A, B 모두 PG authorize 호출 → 두 번 청구됨

try {
    return transactionTemplate.execute(...);  // B만 DataIntegrityViolationException
} catch (DataIntegrityViolationException e) {
    // B의 authorizationId는 DB에 저장되지 않은 채 PG에 고아 승인으로 남음
}
```

Mock PG에서는 무해하지만, 실 PG 연동 시 두 번 승인 요청이 날아간다. B의 `authorizationId`는 DB에 기록되지 않으므로 만기까지 금액이 묶인다. `idempotencyKey`로 DB UNIQUE + `SELECT FOR UPDATE` 또는 Redis 락 추가 필요.

### 3.2 `ChatController` 경로 소유권 혼재 ✅ 해결 (5-chat-gaps step 1)

`ChatController`에 `@RequestMapping("/chat")`이 추가되어 `/requests/*` 네임스페이스에서 완전히 분리됐다. 모든 채팅 경로가 `/chat/` 하위로 통합.

### 3.3 `MatchNotificationListener` — `match.offer.created` 발행자 ✅ 확인 (5-chat-gaps step 3)

`MatchDispatcher.onMatchDispatch()` (`request/service/MatchDispatcher.java:38`)에서 `@TransactionalEventListener(AFTER_COMMIT)`으로 `"match.offer.created"`를 발행한다. 정상 동작 확인.

### 3.4 `PaymentService.refund()` — HelpRequest 상태 미복원 범위 보강 🟡

```java
// PaymentService.java — refund()
intent.refund();
return toResponse(paymentIntentRepository.save(intent));
// helpRequestRepository 미사용 → HelpRequest는 COMPLETED 유지
```

환불 후 `HelpRequest`가 `COMPLETED`로 남으면 가이드 `completedCount`(`PublicProfileResponse`)에 환불된 거래가 포함된다. 환불 시 요청 상태 처리 정책(COMPLETED 유지 vs. 별도 REFUNDED 상태 도입) 결정이 필요하다.

---

## 4. 제안 목록별: 검증 + 공동 평가

(질문 스레드 1~14 — 가정 검증은 §1·§2로 대체하고, 여기서는 **영향·평가**만 유지·보강)

### 상 (1~5)

**1. 채팅 읽음 (`last_read_message_id`, unread, 동기화)**

- **코드 메모:** §2.1 선행 작업 완료 — `GET /chat/rooms`·`ChatRoomSummaryResponse` 구현됨. 이제 읽음 구현이 바로 가능하다. Flyway + `ChatService` + (선택) STOMP read 이벤트 + 모바일 배지.
- **평가:** 선행 차단 해소. 실행 가능 상태.

**2. 가이드 위치 Heartbeat + TTL**

- **코드 메모:** 서버는 변화 없음. 모바일은 `OnDutyToggle`이 **단발 위치**만 보냄 → heartbeat는 **RN 측 주기 호출 or 백그라운드 태스크** 설계가 필수.
- **평가:** Redis·운영 스토리에 유리 (기존 평가 유지).

**3. 결제 상태 세분화**

- **코드 메모:** `PaymentService.refund`와 `PaymentIntent.refund()`가 동기 단계. Mock PG에 지연·재시도 시나리오를 넣기 좋음. 캡처와 동시에 `toCompleted()` — 환불 시 요청 상태 되돌림 정책은 **별도 설계** (현재 코드에 없음). §3.1 PG 이중 호출 문제를 이 작업과 함께 수정 권장.
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

## 5. 제안 목록 외 — 코드에서 짚을 갭 (전체)

| 항목                                        | 근거                                                                      | 심각도 | 상태 |
| ------------------------------------------- | ------------------------------------------------------------------------- | ------ | ---- |
| **`GET /chat/rooms` 구현 또는 모바일 수정** | §2.1 — 현재 연동 불일치. 단순 URL 추가가 아닌 3-way JOIN + 신규 DTO 작업. | 🔴     | ✅ 완료 (step 1) |
| **PG 이중 호출 경쟁 조건**                  | §3.1 — `createIntent()` 락 없음. 실 PG 연동 전 블로커.                    | 🔴     | ⏳ 미해결 |
| **`ChatListScreen` 오류 침묵**              | §2.2 — `isError` 분기 없어 API 오류가 빈 목록으로 표시됨.                 | 🟡     | ✅ 완료 (step 0) |
| **요청 취소 REST**                          | `toCancelled()`만 존재, API 없음.                                         | 🟡     | ✅ 완료 (step 2) — `DELETE /requests/{id}` |
| **`IN_PROGRESS` 사용 여부 결정**            | 호출부 없음. 제거·문서화·"서비스 시작" API 중 택일.                       | 🟡     | ✅ 완료 (step 3) — `POST /requests/{id}/start` |
| **`start_at` 정책 명시**                    | 필드만 있고 매칭 타이밍에 미반영.                                         | 🟡     | ⏳ 미해결 |
| **`ChatController` 경로 혼재**              | §3.2 — `/requests/*` 네임스페이스 공유. `/chat/rooms` 구현 시 함께 정리.  | 🟡     | ✅ 완료 (step 1) |
| **`match.offer.created` 발행자 확인**       | §3.3 — `MatchDispatcher`에서 발행하는지 별도 확인 필요.                   | 🟡     | ✅ 확인 (step 3) — `MatchDispatcher.java:38` |
| **환불 후 completedCount 오염**             | §3.4 — 환불 시 HelpRequest 상태·가이드 통계 정책 결정 필요.               | 🟡     | ⏳ 미해결 |

---

## 6. 추천 순서 (코드 검증 반영 최종판)

**실행 순서 제안**

~~0-a. **즉시 (5분):** `ChatListScreen` `isError` 분기 추가~~ ✅ 완료
~~0-b. **선행:** `GET /chat/rooms` 백엔드 추가~~ ✅ 완료
~~**빠른 승리:** 요청 취소 REST (`DELETE /requests/{id}`)~~ ✅ 완료
~~**빠른 승리:** `IN_PROGRESS` 용도 정리 (`POST /requests/{id}/start`)~~ ✅ 완료
~~**빠른 승리:** `match.offer.created` 발행자 확인~~ ✅ 확인됨

**남은 순서:**

1. **2 — GEO heartbeat/TTL** (서버 TTL/보조키 + RN 주기 duty)
2. **4 — notification 테이블 + API**
3. **3 — 결제 상태 세분화** + §3.1 PG 이중 호출 경쟁 조건 수정 병행
4. **1 — 채팅 읽음** (`last_read_message_id`, unread, 모바일 배지) — 선행 완료로 바로 가능
5. **5 — 서비스 경계 정리**
6. **잔여 미해결:** `start_at` 정책 명시, 환불 후 `completedCount` 오염 정책 결정

---

## 7. `pr-docs`·문서 참고

- 도메인: `pr-docs/도메인/backend-chat.md`, `backend-payment.md`, `backend-notification.md`
- 프론트 갭: `pr-docs/frontend-web-mobile-gap-analysis.md` (**§2.3 시차 주의**)
- 인프라: `pr-docs/Redis-RabbitMQ.md`

---

_`docs/API_CONVENTIONS.md` 동기화 완료 (2026-05-01): 채팅 섹션 `/chat/` 경로 통합, `DELETE /requests/{id}`, `POST /requests/{id}/start` 추가._
