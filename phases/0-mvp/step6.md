# Step 6: backend-payment

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ADR.md` (ADR-005: Mock PG)
- `/docs/API_CONVENTIONS.md`
- `/backend/src/main/java/com/localnow/common/ErrorCode.java`
- `/backend/src/main/java/com/localnow/infra/pg/PaymentGateway.java`
- `/backend/src/main/java/com/localnow/infra/pg/MockPaymentGateway.java`
- `/backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- `/backend/src/main/java/com/localnow/user/domain/User.java`

이전 step에서 만들어진 PaymentGateway 인터페이스와 MockPaymentGateway를 먼저 읽고 연결 방식을 파악한 뒤 작업하라.

## 작업

`payment/` 도메인과 `review/` 도메인: 결제 흐름(Mock PG)과 완료 후 가이드 평점을 처리한다.

---

### Payment 파트

#### 1. DB 마이그레이션 `V6__payment.sql`

```sql
CREATE TABLE payment_intents (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    request_id       BIGINT       NOT NULL UNIQUE,
    payer_id         BIGINT       NOT NULL,   -- 여행자
    payee_id         BIGINT       NOT NULL,   -- 가이드
    amount_krw       BIGINT       NOT NULL,
    platform_fee_krw BIGINT       NOT NULL,
    guide_payout_krw BIGINT       NOT NULL,
    status           ENUM('AUTHORIZED','CAPTURED','REFUNDED','FAILED') NOT NULL DEFAULT 'AUTHORIZED',
    authorization_id VARCHAR(100),
    capture_id       VARCHAR(100),
    idempotency_key  VARCHAR(100) NOT NULL UNIQUE,
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    FOREIGN KEY (request_id) REFERENCES help_requests(id),
    FOREIGN KEY (payer_id)   REFERENCES users(id),
    FOREIGN KEY (payee_id)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 2. `payment/domain/PaymentIntent.java`

- 위 테이블과 1:1 매핑.
- `status`: `PaymentStatus` enum (`AUTHORIZED`, `CAPTURED`, `REFUNDED`, `FAILED`).
- 상태 전이 메서드: `capture(captureId)`, `refund()`. 잘못된 전이면 `IllegalStateException`.

#### 3. `payment/repository/PaymentIntentRepository.java`

- `Optional<PaymentIntent> findByRequestId(Long requestId)`
- `Optional<PaymentIntent> findByIdempotencyKey(String key)`

#### 4. `payment/dto/`

- `CreatePaymentIntentRequest`: `requestId`. (여행자가 confirm 직후 호출)
- `PaymentIntentResponse`: `id`, `requestId`, `amountKrw`, `platformFeeKrw`, `guidePayout`, `status`, `createdAt`.
- `CaptureRequest`: (빈 body — requestId는 path variable로)

#### 5. `payment/service/PaymentService.java`

```java
PaymentIntentResponse createIntent(Long travelerId, Long requestId);
PaymentIntentResponse capture(Long requestId, Long travelerId);
PaymentIntentResponse refund(Long requestId, Long travelerId);
```

`createIntent` 규칙:
1. `HelpRequest` 조회. status가 `MATCHED`인지 확인.
2. 멱등키: `"payment:{requestId}"`. 이미 존재하면 기존 intent 반환.
3. 수수료 계산:
   - `requestType == EMERGENCY` → 플랫폼 수수료 25%.
   - 그 외 → 15%.
   - `platformFeeKrw = amountKrw * rate` (반올림, Long 정수 유지).
   - `guidePayout = amountKrw - platformFeeKrw`.
4. `MockPaymentGateway.authorize(amountKrw, idempotencyKey)` 호출.
5. `PaymentIntent` 저장 (status=AUTHORIZED).

`capture` 규칙:
1. `PaymentIntent` 조회. status가 `AUTHORIZED`가 아니면 `PAYMENT_INVALID_STATE(409)`.
2. `MockPaymentGateway.capture(authorizationId)` 호출.
3. status → `CAPTURED`, `HelpRequest.toCompleted()` 호출 (같은 트랜잭션).

#### 6. `payment/controller/PaymentController.java`

| HTTP | Path | 설명 |
|------|------|------|
| POST | `/payments/intent`         | 결제 의도 생성 |
| POST | `/payments/{requestId}/capture` | 캡처 (완료) |
| POST | `/payments/{requestId}/refund`  | 환불 |
| GET  | `/payments/{requestId}`        | 결제 상태 조회 |

---

### Review 파트

#### 7. DB 마이그레이션 `V7__review.sql`

```sql
CREATE TABLE reviews (
    id          BIGINT  NOT NULL AUTO_INCREMENT,
    request_id  BIGINT  NOT NULL UNIQUE,
    reviewer_id BIGINT  NOT NULL,   -- 여행자
    reviewee_id BIGINT  NOT NULL,   -- 가이드
    rating      TINYINT NOT NULL,   -- 1~5
    comment     TEXT,
    created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    FOREIGN KEY (request_id)  REFERENCES help_requests(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    FOREIGN KEY (reviewee_id) REFERENCES users(id),
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 8. `review/domain/Review.java` + `review/repository/ReviewRepository.java`

#### 9. `review/dto/`

- `CreateReviewRequest`: `rating`(1~5), `comment`.
- `ReviewResponse`: `id`, `requestId`, `revieweeId`, `rating`, `comment`, `createdAt`.

#### 10. `review/service/ReviewService.java`

```java
ReviewResponse createReview(Long reviewerId, Long requestId, CreateReviewRequest req);
```

규칙:
1. `HelpRequest` 조회. status가 `COMPLETED`인지 확인. 아니면 예외.
2. reviewer가 해당 요청의 travelerId인지 확인. 아니면 `AUTH_FORBIDDEN(403)`.
3. 이미 리뷰가 있으면 중복 방지(UNIQUE 제약).
4. 리뷰 저장 후, `User(guide).avgRating`과 `ratingCount` 업데이트 (집계 쿼리 또는 도메인 메서드).

#### 11. `review/controller/ReviewController.java`

| HTTP | Path | 설명 |
|------|------|------|
| POST | `/requests/{requestId}/review` | 리뷰 작성 |
| GET  | `/users/{userId}/reviews`      | 가이드 리뷰 목록 (cursor 페이징) |

### 12. 테스트

- `PaymentServiceTest.java` (Mockito): createIntent 정상/멱등, capture 상태머신, PAYMENT_INVALID_STATE 예외
- `ReviewServiceTest.java` (Mockito): 정상 리뷰 생성, COMPLETED 아닌 요청에 리뷰 → 예외, 중복 리뷰 → 예외

## Acceptance Criteria

```bash
cd backend && ./gradlew check
```

## 검증 절차

1. `./gradlew check` 실행.
2. 체크리스트:
   - `amountKrw`, `platformFeeKrw`, `guidePayout`이 모두 Long 정수인가? Double 사용 금지.
   - `capture`가 `@Transactional` 안에서 `HelpRequest.toCompleted()`까지 묶어서 처리하는가?
   - `idempotencyKey` UNIQUE 제약이 DB에 있는가?
3. `phases/0-mvp/index.json` step 6 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "payment 도메인(PaymentIntent 상태머신/수수료 계산/PaymentController) + review 도메인(ReviewService/ReviewController) + V6+V7 마이그레이션 완료. ./gradlew check 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- 금액(`amountKrw`, `platformFeeKrw`)을 Double로 저장하지 마라. 이유: 부동소수점 오차로 금액이 틀어진다.
- `capture`와 `HelpRequest.toCompleted()`를 별도 트랜잭션으로 분리하지 마라. 이유: 결제 완료와 요청 완료는 원자적으로 이루어져야 한다.
- 실제 PG API를 호출하지 마라. 이유: ADR-005, MVP 제외 사항.
- 기존 테스트를 깨뜨리지 마라.
