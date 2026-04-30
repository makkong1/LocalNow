# 백엔드 동시성·트랜잭션 리팩토링 요약 (phase `3-concurrency-fix`)

> **형식**: 문제 → 해결 → 결과  
> **대상 코드**: `backend/` (매칭 수락/확정, 결제 의도, 리뷰 평점, 낙관적 락 응답, Redis 락 설정)  
> **상세 트러블슈팅 맥락**: [`backend-concurrency-and-transactions.md`](./backend-concurrency-and-transactions.md)

---

## 1. 매칭 수락 `MatchService.accept`

| 구분 | 내용 |
|------|------|
| **문제** | ① `@Transactional(readOnly = true)` 안에서 `save()`로 쓰기 → 드라이버/DB에 따라 `READ ONLY` 트랜잭션과 충돌 가능. ② 동일 `(requestId, guideId)` 동시 수락 시 둘 다 INSERT 시도 → `UNIQUE(request_id, guide_id)` 위반 → 처리 없으면 **500**. API는 “동일 가이드 재호출 시 기존 offer” 멱등이어야 함. |
| **해결** | ① 클래스/메서드에 읽기 전용 트랜잭션 제거. 기존 offer 있으면 즉시 반환. 신규 저장만 `TransactionTemplate.execute()`로 감쌈 (`confirm`과 동일 패턴). ② `save`에서 `DataIntegrityViolationException`이 나면 서브트랜잭션만 롤백된 뒤 바깥에서 `findByRequestIdAndGuideId`로 재조회해 동일 응답 반환. |
| **결과** | 쓰기 경로의 트랜잭션 의미가 명확해짐. 동시 수락 시에도 **500 대신 정상 응답 또는 기존 멱등 동작**에 가깝게 수렴. `MatchServiceTest` 단위 테스트 + `MatchServiceConcurrencyIT` 동시 수락 시나리오로 검증. |

---

## 2. 낙관적 락 충돌 응답 (`HelpRequest.@Version` 등)

| 구분 | 내용 |
|------|------|
| **문제** | `ObjectOptimisticLockingFailureException`이 전역 핸들러에서 일반 예외로 처리되어 **500** → 클라이언트가 “재조회 후 재시도”로 분기하기 어려움. |
| **해결** | `ErrorCode.OPTIMISTIC_LOCK_CONFLICT`(HTTP 409) 추가. `GlobalExceptionHandler`에서 해당 예외를 **409 + 공통 `ApiResponse` 실패 봉투**로 매핑. `docs/API_CONVENTIONS.md`, `web/src/types/api.ts`, `mobile/src/types/api.ts`의 `ErrorCode` 유니언 동기화. |
| **결과** | 버전 충돌 시 **의미 있는 코드**로 응답해 앱/웹이 재시도·재조회 UX를 설계할 수 있음. `GlobalExceptionHandlerTest`로 검증. |

---

## 3. 결제 의도 `PaymentService.createIntent` 동시 생성

| 구분 | 내용 |
|------|------|
| **문제** | `findByIdempotencyKey` 미스 후 동시에 두 요청이 `authorize`+`save` → `idempotency_key`/`request_id` UNIQUE 위반 → **500**. 규약상 같은 `requestId` 재호출은 기존 intent 반환(멱등). |
| **해결** | `save`를 `TransactionTemplate.execute()` 안에서 수행하고, `DataIntegrityViolationException` 시 `findByIdempotencyKey`로 **이미 커밋된 행**을 읽어 `toResponse` (전역 핸들러에 DI를 얹지 않음 — 다른 제약 위반과 구분 불가하므로). |
| **결과** | 레이스에서도 **멱등 응답**으로 수렴 가능. Mock PG 이중 `authorize` 가능성은 남지만, DB 오류로 500이 나는 빈도는 줄어듦. `PaymentServiceTest`에 멱등·동시 유니크 위반 재조회 케이스 추가. |

---

## 4. 리뷰 후 가이드 평점 `ReviewService` / `UserRepository`

| 구분 | 내용 |
|------|------|
| **문제** | `updateGuideRating`이 read-modify-write(`findById` → 평균 계산 → `save`). `User`에 `@Version` 없음 → **동시 리뷰(서로 다른 요청, 동일 가이드)** 시 **lost update**로 `rating_count`/`avg_rating` 왜곡 가능. |
| **해결** | `UserRepository.incrementRating(guideId, newRating)` — JPQL **`UPDATE` 한 번**으로 `avgRating = round((avg*count+new)/(count+1), 2)`, `ratingCount = count + 1`. `ReviewService`는 해당 메서드만 호출. `User`에 `@Version` 추가 금지(다른 경로 낙관적 락 확산 방지). |
| **결과** | DB 단에서 갱신이 직렬화되어 **평균·건수 정합성**이 보장됨. `ReviewServiceTest`에서 `incrementRating` 호출 검증, `UserRepositoryIT`에서 동시 10스레드·동일 점수 시 `ratingCount=10`, `avgRating=5.00` 검증(Testcontainers MySQL, Docker 없으면 skip). |

---

## 5. 매칭 확정 Redis 락 TTL `MatchService.confirm`

| 구분 | 내용 |
|------|------|
| **문제** | 락 TTL이 코드에 `5초` 고정 → 운영에서 P99 트랜잭션이 길어지면 만료·재경합 위험, 환경별 튜닝 불가. 락 실패 시 관측 포인트가 부족. |
| **해결** | `app.match.confirm-lock-ttl` / 환경변수 `MATCH_CONFIRM_LOCK_TTL`(Spring `Duration`, 예: `5s`, `15s`)로 주입. `setIfAbsent(..., confirmLockTtl)`. TTL이 0 이하이면 **기동 시 `IllegalArgumentException`**. 락 미획득 시 `WARN` 로그(`requestId`, `lockKey`, `ttl`). |
| **결과** | 배포·환경별로 TTL 조정 가능. 잘못된 설정은 기동 단계에서 차단. 운영 로그로 락 경합 추적이 쉬워짐. `MatchServiceTest`에서 `setIfAbsent`에 전달되는 `Duration` 검증. |

---

## 6. 부가: 테스트 인프라 (Testcontainers)

| 구분 | 내용 |
|------|------|
| **문제** | 일부 환경에서 docker-java 기본 API 버전이 낮아 최신 Docker 데몬과 맞지 않아 IT 초기화 실패. |
| **해결** | `backend/build.gradle`의 `test` 태스크에 `DOCKER_API_VERSION` 기본값(예: `1.43`) 설정(환경변수로 덮어쓰기 가능). |
| **결과** | 로컬/CI에서 MySQL IT가 동일 스크립트로 돌아갈 확률이 높아짐. Docker가 없으면 기존과 같이 `@Testcontainers(disabledWithoutDocker = true)`로 skip. |

---

## 한 줄 메타

| Step (harness) | 이름 | 핵심 산출물 |
|----------------|------|-------------|
| 0 | `accept-idempotent` | `MatchService.accept` + IT/단위 테스트 |
| 1 | `exception-handler-payment` | `OPTIMISTIC_LOCK_CONFLICT`, 핸들러, `createIntent` 멱등, 타입/API 문서 |
| 2 | `review-rating-atomic` | `UserRepository.incrementRating`, `ReviewService`, `UserRepositoryIT` |
| 3 | `match-confirm-lock-ttl` | 설정 가능한 confirm 락 TTL + 로깅 |

검증 시 로컬에서는 `cd backend && ./gradlew check` 권장(Java 17, Docker는 IT 선택).
