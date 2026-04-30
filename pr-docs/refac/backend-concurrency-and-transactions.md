# 백엔드 동시성 · 트랜잭션 · 락 — 트러블슈팅 & 리팩토링 가이드

> 대상: `backend/` Spring Boot + JPA + Redis  
> 목적: 운영/부하에서 터질 수 있는 경쟁 조건, 트랜잭션 경계, 락 이슈를 코드 기준으로 정리하고 대응·개선 방향을 제시한다.

**리팩토링 적용 내역(문제 → 해결 → 결과)**는 [`backend-concurrency-refactor-summary.md`](./backend-concurrency-refactor-summary.md)에 정리되어 있다.

---

## 1. 전체 맵 (어디서 무엇을 쓰는지)

| 영역 | 락 / 일관성 수단 | 트랜잭션 |
|------|------------------|----------|
| 매칭 **확정** `MatchService.confirm` | Redis `SET NX` + **설정 가능** TTL (`app.match.confirm-lock-ttl`), `lock:request:{id}` | `TransactionTemplate` → `doConfirm` 단일 트랜잭션 |
| `HelpRequest` 조회(확정 시) | JPA `PESSIMISTIC_WRITE` (`findByIdWithLock`) | 위와 동일 트랜잭션 안 |
| `HelpRequest` 엔티티 | `@Version` (낙관적 락 컬럼) | 다른 경로에서 갱신 시 `OptimisticLockException` 가능 → **전역 409 `OPTIMISTIC_LOCK_CONFLICT`** |
| 매칭 **수락** `MatchService.accept` | DB `UNIQUE(request_id, guide_id)` + **`DataIntegrityViolationException` 시 재조회 멱등** | 신규 저장만 `TransactionTemplate` (readOnly 트랜잭션 **미사용**) |
| 결제 `PaymentService.createIntent` | DB 유니크 + **`TransactionTemplate` + DI catch → idempotencyKey 재조회** | `createIntent`는 공개 메서드에 `@Transactional` 없음 |
| 리뷰 + 가이드 평점 | **`UserRepository.incrementRating` 단일 `UPDATE`(JPQL round)** | `@Transactional` `createReview` 안에서 호출 |
| 채팅방 생성 `ChatService.createRoom` | `request_id` 유일(채팅방) + idempotent `find` | `confirm` 트랜잭션에 **참여**(같은 스레드에서 중첩) |
| 이벤트 발행 | `afterCommit` 콜백 / `@TransactionalEventListener(AFTER_COMMIT)` | 커밋 후 브로커 실패 시 **유실 가능** (ADR-003) |

---

## 2. 매칭 확정 (`MatchService.confirm` / `doConfirm`)

### 2.1 설계 요약 (잘 된 부분)

1. **분산 락**: `setIfAbsent(lockKey, lockValue, confirmLockTtl)` 로 동일 `requestId`에 대한 확정을 직렬화(TTL은 설정으로 조정).
2. **원자적 해제**: Lua 스크립트로 `GET` 값이 본인 `lockValue`일 때만 `DEL` — 타인이 만료 후 재획득한 키를 지우지 않음.
3. **finally**: 예외·정상 모두 `releaseLock` 호출.
4. **DB**: `findByIdWithLock` 으로 `HelpRequest`에 **배타 락** → 같은 행에 대한 동시 갱신과 맞물림.
5. **트랜잭션**: `confirm()`은 클래스 레벨 `@Transactional`이 없고, `TransactionTemplate.execute`만으로 쓰기 트랜잭션을 한 번 열어 **경계가 명확**함.
6. **후속**: `chatService.createRoom`, `helpRequestRepository.save` 가 **같은 트랜잭션**에 묶일 수 있음(기본 전파 `REQUIRED`).

### 2.2 트러블슈팅 시나리오

| 증상 | 가능 원인 | 확인 방법 |
|------|-----------|-----------|
| 확정 직후 `409` / `MATCH_ALREADY_CONFIRMED` | 다른 요청이 이미 확정했거나, 락 대기 중 상태가 아닌 비즈니스 충돌 | 로그에 `requestId`, Redis 락 키, `HelpRequest.status` |
| 간헐적 확정 실패 + Redis 키 없음 | 5초 TTL 내 DB 트랜잭션이 끝나지 않음(느린 쿼리·락 대기) | APM, MySQL `innodb_lock_wait_timeout`, 트랜잭션 길이 |
| `OptimisticLockException` on `HelpRequest` | `@Version` 과 동시에 다른 트랜잭션이 같은 `HelpRequest` 갱신 | 스택에 `StaleStateException`, 갱신 경로 전수 조사 |
| 채팅방은 있는데 매칭만 롤백된 듯함 | (드묾) 외부 예외 after partial flush — 설계상 한 트랜잭션이면 함께 롤백되어야 함 | 트랜잭션 로그, `REQUIRES_NEW` 여부 점검 |

### 2.3 리팩토링 아이디어

- **락 TTL**: 5초는 로컬·저부하에 맞춘 값. 운영에서는 P99 트랜잭션 시간 + 여유로 재검토. TTL 만료 후 재시도 시 **이미 MATCHED**면 멱등하게 409 처리 유지.
- **에러 구분**: 락 획득 실패(경합) vs 이미 종료된 요청(비즈니스)을 클라이언트에 구분하면 UX·재시도 정책이 좋아짐(현재는 둘 다 유사한 409일 수 있음).
- **낙관적 락**: `HelpRequest`에 `@Version`이 있는데, 확정 경로는 비관적 락 위주. 다른 서비스에서 같은 엔티티를 버전 없이 오래 잡고 쓰면 충돌 — **갱신하는 모든 경로**를 점검하는 것이 리팩토링 포인트.

---

## 3. 매칭 수락 (`MatchService.accept`)

> **현재 코드**: 아래 이슈는 `3-concurrency-fix` step 0에서 대부분 해소됨(요약 문서 참고). 이 절은 당시 문제 정의·배경용으로 유지한다.

### 3.1 이슈 (과거 상태)

1. **`@Transactional(readOnly = true)` 안에서 `matchOfferRepository.save()`**  
   - 읽기 전용 힌트와 쓰기가 공존. DB마다 무시되거나, 예상치 못한 최적화/경고가 날 수 있음.  
   - **리팩토링**: 쓰기가 발생하는 경로는 `@Transactional` (readOnly=false) 로 분리하거나, 수락 전용 메서드로 쪼개기.

2. **경쟁 조건**  
   - 동일 `(requestId, guideId)`에 대해 동시에 두 번 수락 요청이 오면, 둘 다 `findByRequestIdAndGuideId`가 비어 있을 수 있음.  
   - DB **`UNIQUE(request_id, guide_id)`** (`V4__match.sql`)로 최종적으로 한 건만 살아남고, 나머지는 **제약 위반** → 전역 예외 처리에 따라 **500** 가능.  
   - **트러블슈팅**: 로그에 `DataIntegrityViolationException` / MySQL 1062.  
   - **리팩토링**: 유니크 위반을 잡아 **409 + 멱등 응답**(기존 offer 반환)으로 맞추면 클라이언트 재시도에 유리.

3. **`HelpRequest` OPEN 검사**  
   - 락 없이 `findById`만으로 OPEN 확인 → 확정 직전과의 아주 짧은 창에서 상태가 바뀔 수 있음. 수락 자체는 PENDING offer만 추가하므로 치명적이진 않지만, **정책상 “OPEN일 때만 수락”**을 엄격히 하려면 `HelpRequest` 비관적 락 또는 재검증이 필요.

---

## 4. 결제 (`PaymentService`)

### 4.1 `createIntent`

> **현재 코드**: 유니크 위반 시 `TransactionTemplate` + 재조회 멱등(step 1) 적용됨.

- `idempotencyKey` 선조회 후 `orElseGet`에서 PG `authorize` + `save`.  
- **경쟁(과거)**: 두 스레드가 동시에 `findByIdempotencyKey` 미스 → 이중 `authorize` 시도 → 한쪽은 `request_id` / `idempotency_key` **UNIQUE**로 실패 가능.  
- **트러블슈팅**: Mock PG는 성공할 수 있어 중복 intent 저장 시도까지 갈 수 있음 → DB 에러 로그 확인.  
- **리팩토링(적용)**: DB 유니크 위반을 서비스 내 catch 후 **기존 row 반환**으로 매핑.

### 4.2 `capture`

- `PaymentIntent`를 락 없이 읽고 `AUTHORIZED`면 `capture` 후 `HelpRequest.toCompleted()`.  
- 동시 `capture` 두 번: 첫 번째가 `CAPTURED`로 바꾼 뒤 두 번째는 `PAYMENT_INVALID_STATE` 로 막힘 — **대부분 안전**.  
- **긴 트랜잭션**: 실 PG 연동 시 `authorize`/`capture`가 트랜잭션 안에 있으면 **커넥션 점유 시간**이 길어짐. Mock이면 문제화되기 어렵지만, 실연동 시 **PG 호출은 트랜잭션 밖 + 사가/보상** 검토가 일반적.

### 4.3 `refund`

- `capture`와 마찬가지로 상태 검사로 직렬화. 동시 환불은 두 번째가 상태 불일치로 거절.

---

## 5. 리뷰 (`ReviewService.createReview`)

- `request_id` **UNIQUE**로 리뷰 1건 강제 — 동시 두 번 제출 시 한쪽은 DB 에러.  
- **가이드 평점(과거)**: `updateGuideRating`이 read-modify-write → **lost update** 가능.  
- **리팩토링(적용)**: `UserRepository.incrementRating` — 단일 `UPDATE`(JPQL `round`)로 원자 갱신(step 2).

---

## 6. 채팅 (`ChatService`)

### 6.1 `createRoom`

- `requestId` 기준 기존 방 있으면 반환 — **멱등**.  
- 이론상 “다른 `(traveler, guide)` 쌍”으로 재호출 시 기존 방만 반환(검증 없음). 정상 플로우에서는 `confirm` 한 번이므로 실무 리스크는 낮음.

### 6.2 `sendMessage`

- `clientMessageId`로 멱등.  
- `messagingTemplate.convertAndSend`는 **트랜잭션 커밋 전**에 실행될 수 있음 → 구독자는 DB에 아직 없는 메시지를 볼 수 있는 **짧은 윈도우**(일반적인 eventual consistency 이슈).  
- Rabbit `publishAfterCommit`는 메시지 쪽은 커밋 후.

---

## 7. 요청 생성 & 디스패치 (`RequestService` + `MatchDispatcher`)

- `createRequest` 트랜잭션 커밋 후 `MatchDispatchEvent` → `MatchDispatcher`가 **Redis GEO** + Rabbit 발행.  
- **트러블슈팅**: 트랜잭션은 커밋됐는데 Rabbit만 실패 → 가이드에게 알림 누락(ADR-003). Redis 장애 시 GEO 비어 있음 → 알림 대상 없음(ADR-002 fail-soft).

---

## 8. `HelpRequest.@Version` 과 비관적 락

- 확정 경로는 **비관적 락**으로 행을 잠그므로 같은 트랜잭션 내에서 버전 충돌은 거의 없음.  
- **다른 API**에서 `HelpRequest`를 갱신(예: 상태 변경, 필드 수정)하면서 버전이 올라가고, 그와 겹치면 낙관적 락 예외가 날 수 있음.  
- **리팩토링(적용됨)**: `GlobalExceptionHandler`에서 `ObjectOptimisticLockingFailureException` → **409** + `ErrorCode.OPTIMISTIC_LOCK_CONFLICT`.

---

## 9. 우선순위 요약 (리팩토링 백로그)

아래 **높음·중간** 항목은 phase `3-concurrency-fix`에서 반영됨(요약: [`backend-concurrency-refactor-summary.md`](./backend-concurrency-refactor-summary.md)).

| 우선순위 | 항목 | 성격 |
|----------|------|------|
| ~~높음~~ | ~~`accept`의 `readOnly=true` + 쓰기 제거~~ | **적용됨** |
| ~~높음~~ | ~~`accept` 동시 요청 → 유니크 위반 시 멱등~~ | **적용됨** |
| ~~중간~~ | ~~`createIntent` 동시성 → 멱등~~ | **적용됨** |
| ~~중간~~ | ~~`User` 평점 lost update 방지~~ | **적용됨** |
| ~~중간~~ | ~~Redis 확정 락 TTL·모니터링~~ | **TTL 설정 + WARN 로그 적용됨** |
| 낮음 | 실 PG 시 트랜잭션 경계 재설계 | 장기 아키텍처 |
| 낮음 | Outbox로 Rabbit 전달 보장 | 이벤트 유실(이미 ADR) |

---

## 10. 관련 코드 위치 (빠른 점프)

- `MatchService` — Redis 락, `TransactionTemplate`, `doConfirm`, `publishAfterCommit`  
- `HelpRequestRepository#findByIdWithLock` — `PESSIMISTIC_WRITE`  
- `HelpRequest` — `@Version`, 상태 전이 메서드  
- `PaymentService` — 멱등 키, `capture`/`refund` 상태 머신  
- `ReviewService` — 리뷰 유니크, `updateGuideRating`  
- `ChatService` — `createRoom` 멱등, `sendMessage` 멱등 키  
- `MatchDispatcher` — `@TransactionalEventListener(AFTER_COMMIT)`  

문서 갱신 시 실제 코드와 diff를 한 번 더 맞추면 된다.
