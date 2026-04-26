# Step 0: accept-idempotent

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/backend/src/main/java/com/localnow/match/service/MatchService.java`
- `/backend/src/main/java/com/localnow/match/repository/MatchOfferRepository.java`
- `/backend/src/test/java/com/localnow/match/service/MatchServiceConcurrencyIT.java`
- `/backend/src/test/java/com/localnow/match/service/MatchServiceTest.java`

`confirm()` 메서드가 `TransactionTemplate`을 사용하는 방식을 특히 주의 깊게 읽어라. 이 step에서도 같은 패턴을 `accept()`에 적용한다.

## 문제

`MatchService.accept()`에 두 가지 버그가 있다.

### 버그 1: `@Transactional(readOnly = true)` + 쓰기

`accept()`는 `@Transactional(readOnly = true)`로 선언되어 있지만, `orElseGet` 람다 안에서 `matchOfferRepository.save(offer)`를 호출한다. Hibernate는 `readOnly=true` 힌트를 DB 드라이버에 `SET TRANSACTION READ ONLY`로 전달할 수 있어 실제 INSERT가 실패하거나 예측 불가능한 동작이 발생할 수 있다.

### 버그 2: 동시 수락 → `DataIntegrityViolationException` → 500

`match_offers` 테이블에는 `UNIQUE(request_id, guide_id)` 제약이 있다. 두 스레드가 동시에 `accept()`를 호출해 모두 `findByRequestIdAndGuideId`에서 빈 결과를 받으면, 둘 다 `save(offer)`를 시도한다. 한 쪽은 성공하고 다른 쪽은 `DataIntegrityViolationException`이 발생한다. 현재 이 예외를 잡는 핸들러가 없어 500이 반환된다.

API 규약상 `accept()`는 멱등이어야 한다. "동일 guideId로 재호출 시 기존 offer를 반환"이 명세다.

## 작업

### 수정 파일: `backend/src/main/java/com/localnow/match/service/MatchService.java`

**`accept()` 메서드를 다음과 같이 재구성하라:**

1. `@Transactional(readOnly = true)` 어노테이션을 **완전히 제거**한다. (이 메서드는 트랜잭션 없이 진행하고, 쓰기만 `TransactionTemplate`으로 감싼다 — `confirm()`과 동일 패턴)

2. 기존 offer가 있으면 즉시 반환하는 로직은 유지한다.

3. offer를 새로 저장하는 `orElseGet` 블록을 `transactionTemplate.execute()` 호출로 감싸라:
   ```java
   // (시그니처 수준 — 구현은 에이전트 재량)
   try {
       return transactionTemplate.execute(status -> {
           // 1. offer 생성 + save
           // 2. publishAfterCommit 호출 (트랜잭션 커밋 후 Rabbit 발행)
           // 3. toResponse 반환
       });
   } catch (DataIntegrityViolationException e) {
       // 동시 요청이 먼저 저장 완료 → sub-tx는 이미 롤백 → 바깥 컨텍스트에서 재조회
       return matchOfferRepository.findByRequestIdAndGuideId(requestId, guideId)
           .map(existing -> toResponse(existing, userRepository.findById(guideId).orElse(null)))
           .orElseThrow(() -> new ResponseStatusException(
               HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected accept state after duplicate key"));
   }
   ```

   **핵심 이유**: `transactionTemplate.execute()`가 자체 sub-transaction을 열고 커밋/롤백을 관리한다. 이 안에서 `DataIntegrityViolationException`이 발생하면 sub-tx만 롤백된다. 예외가 `transactionTemplate.execute()` 밖으로 나오므로, 외부 EntityManager는 오염되지 않아 재조회가 가능하다. `confirm()`에서 이미 사용 중인 확립된 패턴이다.

4. `DataIntegrityViolationException` import 추가:
   ```java
   import org.springframework.dao.DataIntegrityViolationException;
   ```

### 추가/수정 테스트

#### A. `MatchServiceTest.java` (단위 테스트)

기존 테스트 스타일을 맞춰서 아래 케이스를 추가하라:

- `정상_수락_offer_저장됨`: 신규 offer가 저장되고 PENDING 상태로 반환된다
- `멱등_동일_가이드_재호출_기존_offer_반환`: 같은 (requestId, guideId) 재호출 시 기존 offer를 그대로 반환한다 (save 호출 없음)
- `예외_OPEN_아닌_요청_수락_불가`: 상태가 OPEN이 아닌 요청은 409 CONFLICT

**주의**: readOnly=true가 제거됐으므로, 기존 테스트 중 readOnly 관련 가정이 있으면 수정한다.

#### B. `MatchServiceConcurrencyIT.java` (동시성 통합 테스트)

기존 파일의 Testcontainers 설정(MySQL + Redis + RabbitMQ)을 재사용해서 아래 테스트를 **추가**하라:

```java
@Test
@DisplayName("동시성: 같은 (requestId, guideId) 동시 수락 10개 → 모두 성공 응답, DB에 offer 1건")
void 동시_수락_같은_가이드_멱등() throws InterruptedException {
    // 준비: OPEN 상태 HelpRequest 1개, guide 1명
    // 실행: 10개 스레드가 동시에 accept(requestId, guideId) 호출
    // 검증:
    //   - 모든 스레드가 예외 없이 MatchOfferResponse를 받는다
    //   - DB에 (requestId, guideId) offer가 정확히 1건이다
    //   - 모든 응답의 offer ID가 동일하다
}
```

## Acceptance Criteria

```bash
cd backend && ./gradlew test --tests "com.localnow.match.service.MatchServiceTest" --no-daemon
cd backend && ./gradlew test --tests "com.localnow.match.service.MatchServiceConcurrencyIT" --no-daemon
```

두 명령 모두 BUILD SUCCESSFUL 이어야 한다.

## 검증 절차

1. AC 커맨드를 실행한다.
2. 체크리스트:
   - `accept()`에 `@Transactional(readOnly = true)` 가 남아 있지 않은가?
   - `transactionTemplate.execute()` 안에서 save + publishAfterCommit이 이루어지는가?
   - `DataIntegrityViolationException` catch 후 재조회 로직이 있는가?
   - 동시성 IT 테스트에서 DB offer가 1건만 저장되는가?
3. 결과에 따라 `phases/3-concurrency-fix/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "accept readOnly 제거 + TransactionTemplate 멱등 처리 + 동시성 IT 통과"`
   - 3회 실패 → `"status": "error"`, `"error_message": "구체적 에러"`

## 금지사항

- `@Transactional(propagation = REQUIRES_NEW)`를 새 빈으로 분리하지 마라. `TransactionTemplate`이 이미 동일 목적으로 존재하므로 패턴을 일관되게 유지한다.
- `@Retryable` 등 새 의존성을 추가하지 마라.
- `confirm()` 메서드의 Redis 락 로직은 건드리지 마라. 이 step의 범위는 `accept()`와 그 테스트뿐이다.
- 기존 동시성 IT 테스트(`동시_확정_시_한_명만_성공` 등)를 깨뜨리지 마라.
