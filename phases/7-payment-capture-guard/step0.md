# Step 0: backend-capture-guard

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/Users/maknkkong/project/localNow/CLAUDE.md`
- `/Users/maknkkong/project/localNow/docs/ADR.md`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/domain/HelpRequestStatus.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/payment/service/PaymentService.java`
- `/Users/maknkkong/project/localNow/backend/src/test/java/com/localnow/payment/service/PaymentServiceTest.java`

## 배경

결제 캡처(`POST /payments/{requestId}/capture`)는 여행자가 서비스 완료를 확인하고 실제 금액을 이체하는 행위다.
현재 `HelpRequest.toCompleted()`는 `MATCHED` 또는 `IN_PROGRESS` 상태 모두에서 `COMPLETED` 전이를 허용한다.
이 때문에 가이드가 서비스를 아직 시작하지 않은 `MATCHED` 상태에서도 여행자가 캡처를 호출하면 결제가 완료된다.

**확정된 정책:**
- 캡처는 가이드가 `POST /requests/{id}/start`를 호출해 `IN_PROGRESS` 상태가 된 이후에만 허용한다.
- `MATCHED` 상태에서의 캡처는 409 에러를 반환한다.
- 캡처 이후 환불(`refund`)은 현재 구조(CAPTURED → REFUNDED)를 그대로 유지한다.

## 작업

### 1. `HelpRequest.toCompleted()` 가드 수정

`backend/src/main/java/com/localnow/request/domain/HelpRequest.java`

`toCompleted()` 메서드의 허용 상태를 `IN_PROGRESS`만으로 제한하라:

```java
public void toCompleted() {
    if (status != HelpRequestStatus.IN_PROGRESS) {
        throw new IllegalStateException("Cannot transition to COMPLETED from " + status);
    }
    this.status = HelpRequestStatus.COMPLETED;
}
```

### 2. `PaymentService.capture()` 명시적 가드 추가 및 주석 정리

`backend/src/main/java/com/localnow/payment/service/PaymentService.java`

`capture()` 메서드 내에서 `helpRequestRepository.findById(requestId)` 조회 직후, `request.toCompleted()` 호출 전에 명시적 상태 검증을 추가하라:

```java
HelpRequest request = helpRequestRepository.findById(requestId)
        .orElseThrow(...);

if (request.getStatus() != HelpRequestStatus.IN_PROGRESS) {
    throw new ResponseStatusException(HttpStatus.CONFLICT,
            ErrorCode.PAYMENT_INVALID_STATE.getDefaultMessage());
}

request.toCompleted();
helpRequestRepository.save(request);
```

- 기존에 추가된 `// Allows both MATCHED→COMPLETED (direct) and IN_PROGRESS→COMPLETED (after /start called)` 주석을 제거하라. 이유: 정책이 변경되어 MATCHED → COMPLETED는 더 이상 허용하지 않는다.
- `import com.localnow.request.domain.HelpRequestStatus;`가 이미 있는지 확인하고 없으면 추가하라.

### 3. `PaymentServiceTest` 테스트 추가

`backend/src/test/java/com/localnow/payment/service/PaymentServiceTest.java`에 2개의 테스트를 추가하라:

**테스트 1 — capture 성공 (IN_PROGRESS 상태):**
```java
@Test
void capture_succeeds_when_request_is_in_progress()
```
- `PaymentIntent.status = AUTHORIZED`, `HelpRequest.status = IN_PROGRESS`로 설정
- `paymentGateway.capture()`가 성공 결과 반환
- `PaymentIntentResponse.status == CAPTURED` 확인
- `helpRequestRepository.save()`가 호출됐는지 확인

**테스트 2 — capture 실패 (MATCHED 상태, 아직 시작 안 함):**
```java
@Test
void capture_throws_409_when_request_is_matched_not_in_progress()
```
- `PaymentIntent.status = AUTHORIZED`, `HelpRequest.status = MATCHED`로 설정
- 409 `ResponseStatusException` 발생 확인
- `paymentGateway.capture()`는 호출되지 않아야 함

## Acceptance Criteria

```bash
cd /Users/maknkkong/project/localNow/backend
./gradlew test --tests "com.localnow.payment.*" --rerun-tasks
./gradlew check
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - `HelpRequest.toCompleted()`가 `IN_PROGRESS`만 허용하는가?
   - `PaymentService.capture()`가 `MATCHED` 상태에서 409를 반환하는가?
   - `capture_succeeds_when_request_is_in_progress` 테스트가 통과하는가?
   - `capture_throws_409_when_request_is_matched_not_in_progress` 테스트가 통과하는가?
   - 기존 테스트가 모두 통과하는가?
3. 결과에 따라 `phases/7-payment-capture-guard/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "HelpRequest.toCompleted() IN_PROGRESS 전용으로 변경, PaymentService.capture() 명시적 MATCHED 차단 가드 추가, 테스트 2케이스 통과"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `HelpRequestStatus` enum에서 `MATCHED`를 제거하지 마라. 이유: MATCHED는 매칭 확정 상태로 여전히 유효하게 사용된다.
- `PaymentService.refund()` 로직을 변경하지 마라. 이유: 환불 흐름(CAPTURED → REFUNDED)은 이번 step 범위 밖이다.
- 기존 `createIntent` 관련 테스트를 수정하지 마라. 이유: createIntent는 MATCHED 상태에서 정상 동작해야 하며 이번 변경과 무관하다.
- 기존 테스트를 깨뜨리지 마라.
