# Test Generation Skill

## 트리거

사용자가 테스트 생성, 테스트 작성, 테스트 실행을 요청할 때 실행한다.
`/review`, `/refactor`, `/fix` 완료 후 자동으로 제안된다.

## 테스트 전략

### 변경 코드 기반 테스트 범위 자동 결정

#### 백엔드 (`backend/`)

| 변경된 파일 | 생성할 테스트 |
|-----------|-------------|
| `*Service.java` | 단위 테스트 (JUnit 5 + Mockito + AssertJ) |
| `*Repository.java` | 통합 테스트 (`@DataJpaTest` 또는 Testcontainers MySQL) |
| `*Controller.java` | API 테스트 (`@WebMvcTest`, 응답은 `ApiResponse<T>` 봉투 검증) |
| Redis / Rabbit / WebSocket 연동 | Testcontainers 기반 통합 테스트 |
| `*Entity.java` | 연관 테스트가 있으면 업데이트, 없으면 생성 안 함 |

#### 웹 (`web/`)

| 변경된 파일 | 생성할 테스트 |
|-----------|-------------|
| `src/lib/**.ts`, 순수 함수 | Vitest 단위 테스트 |
| `src/components/client/*.tsx` (인터랙션) | Vitest + React Testing Library |
| `src/app/api/**/route.ts` (Route Handler) | Vitest 로 fetch mocking |
| Server Component | 일반적으로 e2e 로 커버, 단위 테스트 강제 X |
| 핵심 사용자 플로우 | Playwright 시나리오 (MVP 에서는 1~2개만) |

### 필수 테스트 케이스 3종

모든 테스트는 반드시 아래 3가지를 포함한다:

```
1. ✅ 정상 케이스 (Happy Path)
   - 올바른 입력 → 기대 결과

2. ❌ 예외 케이스 (Exception Path)
   - 잘못된 입력, 권한 없음, 존재하지 않는 데이터
   - 기대하는 예외 타입과 메시지 검증

3. 🔲 경계값 (Boundary)
   - null, 빈 문자열, 0, 최대값
   - 페이징: page=0, size=1, 마지막 페이지
```

### LocalNow 특화 테스트

#### 동시성 테스트 (매칭 확정)
```java
@Test
void 동시_확정_시_한_명만_성공() throws Exception {
    int threadCount = 10;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    CountDownLatch latch = new CountDownLatch(threadCount);
    AtomicInteger success = new AtomicInteger();
    AtomicInteger conflict = new AtomicInteger();

    for (int i = 0; i < threadCount; i++) {
        long candidateGuideId = guides.get(i).getId();
        executor.submit(() -> {
            try {
                matchService.confirm(requestId, candidateGuideId);
                success.incrementAndGet();
            } catch (MatchAlreadyConfirmedException e) {
                conflict.incrementAndGet();
            } finally {
                latch.countDown();
            }
        });
    }
    latch.await();

    assertThat(success.get()).isEqualTo(1);
    assertThat(conflict.get()).isEqualTo(threadCount - 1);
}
```

적용 대상:
- 매칭 확정 (Redis 분산락 + `@Version` 낙관적 락)
- 결제 캡처 (중복 캡처 방지, 멱등성)
- 가이드 on-duty 토글과 GEO 인덱스 동기화

#### 트랜잭션 / AFTER_COMMIT 이벤트 테스트
```java
@Test
void 결제_실패_시_매칭_상태_롤백() {
    assertThatThrownBy(() -> matchService.confirmWithPayment(requestId, guideId))
        .isInstanceOf(PaymentFailedException.class);
    assertThat(helpRequestRepository.findById(requestId).get().getStatus())
        .isEqualTo(HelpRequestStatus.OPEN);
}

@Test
void 확정_커밋_이후에만_RabbitMQ_이벤트_발행된다() {
    // ApplicationEventPublisher 로 이벤트 발행 후
    // 트랜잭션 롤백 시 RabbitTemplate.send 가 호출되지 않아야 함
}
```

적용 대상:
- 매칭 확정 ↔ 결제 의도 생성 트랜잭션
- AFTER_COMMIT 이벤트 리스너 (매칭 제안 발행, 채팅 오프라인 알림)

#### WebSocket / STOMP 테스트 (Testcontainers)
```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
class ChatFlowIT {
    @Test
    void 매칭_확정된_방에만_구독_허용() {
        // STOMP 클라이언트 두 개로 붙어서
        // 권한 없는 사용자가 /topic/rooms/{id} 를 구독하면 거절되는지 검증
    }
}
```

#### 웹 테스트 예시

```ts
// Vitest + RTL
import { render, screen } from '@testing-library/react';
import { GuideOfferCard } from './GuideOfferCard';

test('확정 버튼 클릭 시 낙관적 상태로 전환된다', async () => {
  // ...
});
```

```ts
// Playwright (핵심 시나리오 1개)
test('여행자-가이드 매칭 + 채팅 라이브 갱신', async ({ browser }) => {
  const traveler = await browser.newContext();
  const guide = await browser.newContext();
  // 두 컨텍스트에서 로그인 → 요청 생성 → 수락 → 확정 → 채팅 왕복
});
```

## 동작 절차

### 1단계: 테스트 대상 분석

변경된 코드를 읽고 테스트가 필요한 메서드를 식별한다:

```
## 테스트 대상 분석

### 변경 파일
- `MatchService.java` → accept(), confirm()

### 생성할 테스트
| # | 메서드 | 케이스 | 테스트명 |
|---|-------|-------|---------|
| 1 | accept  | 정상 | 정상_가이드_수락_오퍼_생성 |
| 2 | accept  | 예외 | 예외_OPEN_이_아닌_요청_수락_불가 |
| 3 | accept  | 경계 | 경계_동일_가이드_중복_수락_시_멱등 |
| 4 | confirm | 정상 | 정상_후보_중_1명_확정_MATCHED_전환 |
| 5 | confirm | 예외 | 예외_본인_요청이_아니면_권한거부 |
| 6 | confirm | 동시성 | 동시_확정_시_한_명만_성공 |

→ 생성할까? (전부 / 번호 선택)
```

### 2단계: 테스트 코드 생성

#### 백엔드 테스트 위치
```
backend/src/test/java/com/localnow/<domain>/
├── service/
│   └── <Service>Test.java          # 단위 테스트 (Mockito)
├── repository/
│   └── <Repository>IT.java         # 통합 테스트 (Testcontainers)
└── controller/
    └── <Controller>Test.java       # API 테스트 (@WebMvcTest)
```

네이밍 규칙: 단위/슬라이스 테스트는 `*Test`, Testcontainers 를 띄우는 통합 테스트는 `*IT` 로 구분.

#### 테스트 네이밍 컨벤션
```java
@Test
@DisplayName("정상: 후보 중 1명을 확정하면 상태가 MATCHED 로 전환된다")
void 정상_후보_중_1명_확정_MATCHED_전환() { }

@Test
@DisplayName("예외: OPEN 이 아닌 요청에는 수락할 수 없다")
void 예외_OPEN_이_아닌_요청_수락_불가() { }

@Test
@DisplayName("경계: 동일 가이드의 중복 수락은 멱등하게 처리된다")
void 경계_동일_가이드_중복_수락_시_멱등() { }
```

#### 웹 테스트 위치
```
web/src/
├── components/client/__tests__/<Component>.test.tsx
├── lib/__tests__/<util>.test.ts
└── app/api/**/__tests__/route.test.ts
tests/e2e/                            # Playwright
```

### 3단계: 테스트 실행

```bash
# 백엔드 - 특정 테스트
cd backend && ./gradlew test --tests "com.localnow.match.service.MatchServiceTest"

# 백엔드 - 전체
cd backend && ./gradlew check

# 웹 - 단위
cd web && npm run test

# 웹 - e2e (로컬에 backend + web 이 떠 있어야 함)
cd web && npm run e2e
```

### 4단계: 결과 보고

```
## 테스트 결과

| # | 테스트 | 상태 | 비고 |
|---|-------|------|------|
| 1 | 정상_가이드_수락_오퍼_생성 | PASS | |
| 2 | 예외_OPEN_이_아닌_요청_수락_불가 | PASS | |
| 3 | 경계_동일_가이드_중복_수락_시_멱등 | FAIL | 분산락은 잡혀있으나 중복 오퍼가 저장됨 |
| 4 | 정상_후보_중_1명_확정_MATCHED_전환 | PASS | |
| 5 | 예외_본인_요청이_아니면_권한거부 | PASS | |
| 6 | 동시_확정_시_한_명만_성공 | PASS | |

### 실패 분석
- **테스트 3 실패**: `MatchOfferRepository` 에 `(requestId, guideId)` UNIQUE 제약 누락
- **수정 필요**: Flyway 새 V 파일로 제약 추가 + Entity 매핑 업데이트

→ 실패 항목 수정할까? (/fix 로 전환)
```

## 워크플로우 연계

- `/review` 완료 → `/test` 제안 (변경 코드 회귀 방지)
- `/refactor` 완료 → `/test` 제안 (리팩토링 검증)
- `/fix` 완료 → `/test` 제안 (수정 확인)
- 테스트 전부 통과 → `/commit` 제안

## 제약

- 테스트는 독립적이어야 한다 (테스트 간 순서 의존 금지).
- Mock 은 필요한 최소한만 사용한다 (과도한 Mock = 의미 없는 테스트).
- 외부 시스템(Redis, Rabbit, MySQL, WebSocket)은 **가능한 한 Testcontainers 로 실제 이미지를 띄워 검증**한다. 막연한 `@MockBean` 범벅은 회피.
- DB 테스트는 `@Transactional` + 롤백 또는 Testcontainers 의 per-test 초기화로 데이터 격리한다.
- 웹 e2e (Playwright) 는 MVP 기간 동안 **핵심 시나리오 1~2개만**. 페이지 단위 모든 경로를 e2e 로 덮지 마라.
- 기존 테스트가 있으면 스타일을 맞춘다.
