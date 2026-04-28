# Step 1: exception-handler-payment

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/API_CONVENTIONS.md` — 에러 코드 표, 응답 포맷 규약
- `/docs/ADR.md`
- `/backend/src/main/java/com/localnow/common/ErrorCode.java`
- `/backend/src/main/java/com/localnow/common/GlobalExceptionHandler.java`
- `/backend/src/main/java/com/localnow/payment/service/PaymentService.java`
- `/backend/src/main/java/com/localnow/payment/repository/PaymentIntentRepository.java`
- `/web/src/types/api.ts`
- `/mobile/src/types/api.ts`

이전 step(step0)에서 `MatchService.accept`의 동시성 처리를 `TransactionTemplate`으로 수정했다. 이 step은 전역 예외 핸들러와 `PaymentService`를 다룬다.

## 문제

### 문제 1: `ObjectOptimisticLockingFailureException` → 500

`HelpRequest` 엔티티에는 `@Version` 낙관적 락이 있다. 확정 경로 이외에서 `HelpRequest`를 갱신하는 다른 경로가 있을 때, 버전 충돌이 발생하면 `ObjectOptimisticLockingFailureException`이 던져진다. 현재 `GlobalExceptionHandler.handleGeneral()`이 이를 잡아 500을 반환한다.

클라이언트에게는 "충돌이 발생했으니 재조회 후 재시도하라"는 의미의 **409** 응답이 필요하다.

### 문제 2: `PaymentService.createIntent` 동시 요청 → 500

`createIntent`는 `findByIdempotencyKey` miss 후 `orElseGet`에서 PG `authorize` + `save`를 실행한다. 두 스레드가 동시에 miss를 경험하면 둘 다 `save`를 시도 → `idempotency_key` UNIQUE 위반 → `DataIntegrityViolationException` → 500.

API 규약: "멱등 — 같은 requestId 재호출 시 기존 intent 반환". 이중 PG 호출은 Mock PG에서는 문제 없지만, 이중 intent 저장 시도 자체가 DB 에러를 유발한다.

## 작업

### 1. `ErrorCode.java`에 `OPTIMISTIC_LOCK_CONFLICT` 추가

```java
OPTIMISTIC_LOCK_CONFLICT(409, "Resource was modified concurrently, please retry"),
```

`INTERNAL_ERROR` 앞에 추가한다.

### 2. `GlobalExceptionHandler.java` 수정

`NoResourceFoundException` 핸들러 뒤에 추가:

```java
@ExceptionHandler(ObjectOptimisticLockingFailureException.class)
public ResponseEntity<ApiResponse<?>> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
    log.warn("Optimistic lock conflict: {}", ex.getMessage());
    return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ApiResponse.fail(ErrorCode.OPTIMISTIC_LOCK_CONFLICT,
                    ErrorCode.OPTIMISTIC_LOCK_CONFLICT.getDefaultMessage()));
}
```

필요한 import:
```java
import org.springframework.orm.ObjectOptimisticLockingFailureException;
```

### 3. `PaymentService.createIntent` 멱등 처리

`orElseGet` 람다 안의 `save(intent)` 호출을 `try-catch(DataIntegrityViolationException)`로 감싸라:

```java
// (시그니처 수준)
try {
    // 기존 PG authorize + save 로직
    return toResponse(paymentIntentRepository.save(intent));
} catch (DataIntegrityViolationException e) {
    // 다른 스레드가 먼저 저장 완료 → 기존 intent 반환
    return paymentIntentRepository.findByIdempotencyKey(idempotencyKey)
        .map(this::toResponse)
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected payment intent state"));
}
```

**주의**: `PaymentService.createIntent`는 이미 `@Transactional`이 있다. `DataIntegrityViolationException`이 `save()` 시점에 발생하면 (GenerationType.IDENTITY → 즉시 INSERT) 현재 트랜잭션이 오염될 수 있다. 이 경우 `findByIdempotencyKey` 재조회도 같은 트랜잭션 안에서 실행되므로 실패할 수 있다.

안전한 구현: `createIntent`의 저장 로직을 `TransactionTemplate`(propagation=REQUIRED, 이미 트랜잭션 안에 있으면 참여)으로 분리하거나, 메서드 레벨 트랜잭션은 유지하되 catch 블록에서 `TransactionSynchronizationManager`를 통해 재조회 가능한지 확인한다. **구현 재량**: 가장 단순하게 동작하는 방법을 선택하되, 동시성 IT 테스트(아래)가 통과해야 한다.

Import 추가:
```java
import org.springframework.dao.DataIntegrityViolationException;
```

### 4. 타입 동기화

`ErrorCode` 에 `'OPTIMISTIC_LOCK_CONFLICT'` 추가:
- `/web/src/types/api.ts` — `ErrorCode` 유니언
- `/mobile/src/types/api.ts` — `ErrorCode` 유니언
- `/docs/API_CONVENTIONS.md` — 에러 코드 표 (형식: `| OPTIMISTIC_LOCK_CONFLICT | 409 | 낙관적 락 충돌, 재조회 후 재시도 필요 |`)

### 5. 테스트

#### A. `GlobalExceptionHandlerTest.java` (또는 기존 파일에 추가)

`@WebMvcTest` 또는 Mockito 기반으로:

- `예외_OptimisticLock_409반환`: `ObjectOptimisticLockingFailureException`을 발생시키면 HTTP 409 + `error.code = "OPTIMISTIC_LOCK_CONFLICT"` 가 반환된다

#### B. `PaymentServiceTest.java` (단위 테스트)

- `정상_결제의도_생성`: requestId → amountKrw, platformFeeKrw, guidePayout 계산 정확
- `멱등_같은_requestId_재호출_기존_intent_반환`: 두 번 호출 시 두 번째는 기존 intent를 반환하고 `paymentGateway.authorize`는 1회만 호출

## Acceptance Criteria

```bash
cd backend && ./gradlew test --tests "com.localnow.payment.service.PaymentServiceTest" --no-daemon
cd backend && ./gradlew compileJava --no-daemon
```

빌드 성공 + 테스트 통과. 웹/모바일 타입 변경은 TypeScript 컴파일 없이 파일 수정으로 완료.

## 검증 절차

1. AC 커맨드를 실행한다.
2. 체크리스트:
   - `ErrorCode.OPTIMISTIC_LOCK_CONFLICT`가 Java enum + web/mobile types + docs 에러 코드 표 모두에 있는가?
   - `GlobalExceptionHandler`에 `ObjectOptimisticLockingFailureException` 핸들러가 있고 409를 반환하는가?
   - `PaymentService.createIntent`가 `DataIntegrityViolationException`을 잡아 기존 intent를 반환하는가?
3. 결과에 따라 `phases/3-concurrency-fix/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "OptimisticLockException 핸들러 + createIntent 멱등 + OPTIMISTIC_LOCK_CONFLICT 에러코드 추가"`
   - 3회 실패 → `"status": "error"`, `"error_message": "구체적 에러"`

## 금지사항

- `DataIntegrityViolationException`을 `GlobalExceptionHandler`에 전역으로 추가하지 마라. FK 위반, NOT NULL 위반 등 다른 제약 위반과 구분이 불가능해 잘못된 멱등 응답을 줄 수 있다. 반드시 서비스 코드에서 특정 호출 지점만 잡아야 한다.
- `PaymentService`의 결제 상태 머신(`capture`, `refund`)은 건드리지 마라. 이 step 범위는 `createIntent`와 전역 예외 핸들러뿐이다.
- ADR-005: 실 PG 연동 금지. `MockPaymentGateway` 구현만 사용한다.
