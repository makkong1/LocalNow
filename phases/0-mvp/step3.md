# Step 3: backend-request

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-002: Redis GEO, ADR-003: RabbitMQ AFTER_COMMIT)
- `/docs/API_CONVENTIONS.md`
- `/backend/src/main/java/com/localnow/common/ApiResponse.java`
- `/backend/src/main/java/com/localnow/common/ErrorCode.java`
- `/backend/src/main/java/com/localnow/infra/redis/RedisGeoService.java`
- `/backend/src/main/java/com/localnow/infra/rabbit/RabbitPublisher.java`
- `/backend/src/main/java/com/localnow/user/domain/User.java`

이전 step에서 만들어진 User 엔티티와 infra 레이어를 읽고 연결 방식을 파악한 뒤 작업하라.

## 작업

`request/` 도메인: 여행자가 도움 요청을 생성·조회하고, 생성 직후 주변 가이드에게 알림 이벤트를 발행한다.

### 1. DB 마이그레이션 `V3__request.sql`

```sql
CREATE TABLE help_requests (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    traveler_id   BIGINT       NOT NULL,
    request_type  ENUM('GUIDE','TRANSLATION','FOOD','EMERGENCY') NOT NULL,
    lat           DOUBLE       NOT NULL,
    lng           DOUBLE       NOT NULL,
    description   TEXT,
    start_at      DATETIME(6)  NOT NULL,
    duration_min  INT          NOT NULL,
    budget_krw    BIGINT       NOT NULL,  -- 정수 최소단위 (원화)
    status        ENUM('OPEN','MATCHED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'OPEN',
    version       INT          NOT NULL DEFAULT 0,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    FOREIGN KEY (traveler_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_help_requests_traveler ON help_requests(traveler_id);
CREATE INDEX idx_help_requests_status   ON help_requests(status);
```

### 2. `request/domain/HelpRequest.java` (JPA 엔티티)

- 위 테이블과 1:1 매핑.
- `requestType`: `RequestType` enum (`GUIDE`, `TRANSLATION`, `FOOD`, `EMERGENCY`).
- `status`: `HelpRequestStatus` enum (`OPEN`, `MATCHED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
- `@Version int version` — 낙관적 락용 (Step 4에서 match confirm 시 사용).
- 상태 전이 메서드: `toMatched()`, `toInProgress()`, `toCompleted()`, `toCancelled()`. 각 메서드는 현재 상태가 올바르지 않으면 `IllegalStateException` throw.

### 3. `request/repository/HelpRequestRepository.java`

`JpaRepository<HelpRequest, Long>` 상속.
- `List<HelpRequest> findByTravelerIdOrderByCreatedAtDesc(Long travelerId)`
- `Page<HelpRequest> findByStatusOrderByCreatedAtDesc(HelpRequestStatus status, Pageable pageable)`

### 4. `request/dto/`

- `CreateRequestRequest`: `requestType`, `lat`, `lng`, `description`, `startAt`(ISO-8601 문자열), `durationMin`, `budgetKrw`. 모두 `@NotNull` 또는 `@NotBlank`.
- `HelpRequestResponse`: `id`, `travelerId`, `requestType`, `lat`, `lng`, `description`, `startAt`, `durationMin`, `budgetKrw`, `status`, `createdAt`.
- `HelpRequestPageResponse`: `items: List<HelpRequestResponse>`, `nextCursor: Long` (null이면 마지막 페이지). Cursor 기반 페이징.

### 5. `request/service/RequestService.java`

```java
HelpRequestResponse createRequest(Long travelerId, CreateRequestRequest req);
HelpRequestResponse getRequest(Long requestId);
HelpRequestPageResponse getMyRequests(Long travelerId, Long cursor, int size);
```

`createRequest` 흐름:
1. `HelpRequest` 저장 (status=OPEN).
2. `@TransactionalEventListener(phase = AFTER_COMMIT)` 를 이용한 이벤트 발행:
   - 커밋 성공 후 `MatchDispatchEvent(requestId, lat, lng)` 발행.
3. `MatchDispatchEvent` 리스너 (`MatchDispatcher`):
   - `RedisGeoService.searchNearby(lat, lng, 5.0)` 로 반경 5km 가이드 조회.
   - `RabbitPublisher.publish("match.offer.created", payload)` 발행. payload: `{ requestId, requestType, lat, lng, budgetKrw, guideIds }`.

가이드 `on-duty` 위치 등록은 Step 10(web-guide)에서 처리되므로, 이 step의 `RedisGeoService.searchNearby`가 빈 목록을 반환해도 정상 동작.

### 6. `request/controller/RequestController.java`

Base URL: `/requests`

| HTTP | Path | 설명 | 인증 |
|------|------|------|------|
| POST | `/requests` | 도움 요청 생성 (TRAVELER 역할만) | 필요 |
| GET  | `/requests/{id}` | 요청 단건 조회 | 필요 |
| GET  | `/requests/me` | 내 요청 목록 (cursor 페이징) | 필요 |

역할 검증: POST는 `SecurityContext`에서 `role=TRAVELER`인지 확인. 아니면 `AUTH_FORBIDDEN(403)`.

### 7. 테스트

#### `request/service/RequestServiceTest.java` (단위, Mockito)

- 정상: 요청 생성 → status=OPEN, travelerId 일치
- 정상: AFTER_COMMIT 이벤트 → `RabbitPublisher.publish` 호출 확인
- 예외: 잘못된 requestType
- 경계: budgetKrw=0 허용 여부 (0 이상이면 통과)

#### `request/repository/HelpRequestRepositoryIT.java` (Testcontainers MySQL)

- 저장 후 `findByTravelerId` 조회

#### `request/infra/MatchDispatcherIT.java` (Testcontainers Redis)

- `RedisGeoService.addGuide` 후 `searchNearby` 결과 검증

## Acceptance Criteria

```bash
cd backend && ./gradlew check
```

## 검증 절차

1. `./gradlew check` 실행.
2. 체크리스트:
   - `AFTER_COMMIT` 이벤트 기반으로 발행하는가? (BEFORE_COMMIT 아님 — 롤백 시 유령 이벤트 방지)
   - `budgetKrw`가 Long(정수)인가? Double 금지.
   - `HelpRequestController`가 `HelpRequestRepository`를 직접 호출하지 않는가?
3. `phases/0-mvp/index.json` step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "request 도메인(HelpRequest 상태머신/RequestService/RequestController) + V3__request.sql + Redis GEO 연동 + RabbitMQ AFTER_COMMIT 발행 완료. ./gradlew check 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- `RabbitPublisher.publish`를 `@Transactional` 메서드 안에서 직접 호출하지 마라. 이유: 트랜잭션 롤백 시 이미 발행된 메시지를 회수할 수 없다 (ADR-003).
- `budgetKrw`를 Double로 저장하지 마라. 이유: 부동소수점 오차로 금액이 틀어진다 (API_CONVENTIONS.md).
- `RequestController`가 `HelpRequestRepository`를 직접 주입받지 마라. 이유: CLAUDE.md CRITICAL 규칙.
- 기존 테스트를 깨뜨리지 마라.
