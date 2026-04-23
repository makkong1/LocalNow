# Step 4: backend-match

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-003: RabbitMQ, ADR-005: Mock PG)
- `/docs/API_CONVENTIONS.md`
- `/backend/src/main/java/com/localnow/common/ErrorCode.java`
- `/backend/src/main/java/com/localnow/infra/redis/RedisGeoService.java`
- `/backend/src/main/java/com/localnow/infra/rabbit/RabbitPublisher.java`
- `/backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- `/backend/src/main/java/com/localnow/request/repository/HelpRequestRepository.java`

이전 step에서 만들어진 HelpRequest 엔티티, 상태 전이 메서드, ErrorCode를 먼저 읽고 연결 방식을 파악한 뒤 작업하라.

## 작업

`match/` 도메인: 가이드가 요청을 수락(accept)하고, 여행자가 후보 중 한 명을 확정(confirm)한다.
확정 시 동시 진입을 차단하는 것이 이 도메인의 핵심이다.

### 1. DB 마이그레이션 `V4__match.sql`

```sql
CREATE TABLE match_offers (
    id           BIGINT  NOT NULL AUTO_INCREMENT,
    request_id   BIGINT  NOT NULL,
    guide_id     BIGINT  NOT NULL,
    status       ENUM('PENDING','CONFIRMED','REJECTED') NOT NULL DEFAULT 'PENDING',
    message      TEXT,
    created_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_match_offer (request_id, guide_id),  -- 동일 가이드 중복 수락 방지
    FOREIGN KEY (request_id) REFERENCES help_requests(id),
    FOREIGN KEY (guide_id)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_match_offers_request ON match_offers(request_id);
CREATE INDEX idx_match_offers_guide   ON match_offers(guide_id);
```

### 2. `match/domain/MatchOffer.java` (JPA 엔티티)

- 위 테이블과 1:1 매핑.
- `status`: `MatchOfferStatus` enum (`PENDING`, `CONFIRMED`, `REJECTED`).

### 3. `match/repository/MatchOfferRepository.java`

- `List<MatchOffer> findByRequestId(Long requestId)`
- `Optional<MatchOffer> findByRequestIdAndGuideId(Long requestId, Long guideId)`
- `int countByRequestIdAndStatus(Long requestId, MatchOfferStatus status)`

### 4. `match/dto/`

- `AcceptRequest`: `message`(nullable).
- `MatchOfferResponse`: `id`, `requestId`, `guideId`, `guideName`, `guideAvgRating`, `status`, `message`, `createdAt`.
- `ConfirmRequest`: `guideId`.

### 5. `match/service/MatchService.java`

#### `accept(Long requestId, Long guideId, AcceptRequest req)`

1. `HelpRequest` 조회. status가 `OPEN`이 아니면 `REQUEST_NOT_OPEN(409)` 예외.
2. 중복 수락 확인: `(requestId, guideId)` 이미 존재하면 멱등하게 기존 offer 반환.
3. `MatchOffer` 저장 (status=PENDING).
4. AFTER_COMMIT: `RabbitPublisher.publish("match.offer.accepted", { requestId, guideId })`.

#### `confirm(Long requestId, Long travelerId, ConfirmRequest req)`

동시성 제어가 핵심이다. 아래 순서를 정확히 따른다:

1. **Redis 분산락 획득**: key=`"lock:request:{requestId}"`, TTL=5초. 획득 실패 시 `MATCH_ALREADY_CONFIRMED(409)`.
2. **락 안에서**:
   a. `HelpRequest` 조회 (`@Lock(PESSIMISTIC_WRITE)` 또는 `@Version` 낙관적 락 사용).
   b. status가 `OPEN`이 아니면 `MATCH_ALREADY_CONFIRMED(409)`.
   c. 선택된 guideId의 `MatchOffer`를 CONFIRMED로, 나머지 offer를 REJECTED로 변경.
   d. `HelpRequest.toMatched()` 호출.
   e. DB 저장 (`@Transactional`).
3. **락 해제** (finally).
4. AFTER_COMMIT: `RabbitPublisher.publish("match.confirmed", { requestId, confirmedGuideId })`.

Redis 분산락 구현: `RedisTemplate.opsForValue().setIfAbsent(key, "1", 5, SECONDS)`. 해제는 Lua 스크립트(자신이 건 락만 해제).

#### `getOffers(Long requestId): List<MatchOfferResponse>`

요청에 달린 모든 offer 조회 (여행자가 후보 목록 보기용).

### 6. `match/controller/MatchController.java`

| HTTP | Path | 설명 | 인증 |
|------|------|------|------|
| POST | `/requests/{requestId}/accept` | 가이드가 수락 (GUIDE 역할만) | 필요 |
| POST | `/requests/{requestId}/confirm` | 여행자가 확정 (TRAVELER 역할만, 본인 요청만) | 필요 |
| GET  | `/requests/{requestId}/offers`  | 수락한 가이드 후보 목록 | 필요 |

### 7. 테스트

#### `match/service/MatchServiceTest.java` (단위, Mockito)

- 정상: accept → MatchOffer PENDING 생성
- 예외: OPEN 아닌 요청에 accept → REQUEST_NOT_OPEN
- 경계: 동일 가이드 중복 accept → 멱등 반환

#### `match/service/MatchServiceConcurrencyIT.java` (Testcontainers MySQL + Redis)

**이 테스트가 이 step의 핵심이다.**

```java
@Test
void 동시_확정_시_한_명만_성공() throws Exception {
    // 10개 스레드가 동시에 confirm 호출
    // success.get() == 1, conflict.get() == 9 검증
}
```

## Acceptance Criteria

```bash
cd backend && ./gradlew check
# 동시성 테스트 포함. success=1, conflict=9 검증 통과 필수.
```

## 검증 절차

1. `./gradlew check` 실행. 동시성 테스트 통과 필수.
2. 체크리스트:
   - 분산락 해제를 Lua 스크립트로 하는가? (단순 `delete`는 타인의 락을 해제할 위험)
   - `AFTER_COMMIT` 이후에 RabbitMQ 발행이 이루어지는가?
   - `MatchController`가 `MatchOfferRepository`를 직접 주입받지 않는가?
3. `phases/0-mvp/index.json` step 4 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "match 도메인(MatchOffer/MatchService with Redis 분산락+낙관적락/MatchController) + V4__match.sql 완료. 동시성 테스트(10스레드→1성공) 통과. ./gradlew check 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- 분산락 해제를 `redisTemplate.delete(key)`만으로 하지 마라. 이유: 자신이 건 락인지 확인 없이 삭제하면 타 스레드의 락을 해제할 수 있다.
- `confirm` 로직에서 분산락 없이 DB 트랜잭션만으로 동시성을 제어하지 마라. 이유: 낙관적 락 재시도 로직 없이는 `ObjectOptimisticLockingFailureException` → 500이 된다.
- `MatchController`가 `HelpRequestRepository`를 직접 주입받지 마라. 이유: request 도메인 내부 접근은 RequestService를 통해야 한다.
- 기존 테스트를 깨뜨리지 마라.
