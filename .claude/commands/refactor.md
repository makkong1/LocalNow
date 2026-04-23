# Refactoring Skill

## 트리거

사용자가 리팩토링, 코드 개선, 성능 최적화를 요청할 때 실행한다.
보통 `/review` (Code Review) 이후에 사용된다.

## 리팩토링 타입 분류

모든 리팩토링은 아래 3가지 타입 중 하나로 분류한다:

### Type 1: 구조 개선 (Structure)
- 아키텍처 일관성, 레이어 분리, 책임 분리
- 예: private `@Transactional` → 별도 빈 분리, 도메인 간 의존 방향 수정

### Type 2: 성능 개선 (Performance)
- 쿼리 수 감소, 응답 시간 단축, 메모리 절약
- 예: N+1 해결, `findAll()` → 페이징, 인덱스 추가

### Type 3: 가독성 (Readability)
- 코드 명확성, 네이밍, 불필요 코드 제거
- 예: DTO → record, `System.out.println` → Logger, 미사용 import 정리

## 동작 절차

### 1단계: 리팩토링 대상 확인

- 코드 리뷰 결과가 있으면 Critical/Warning 항목을 우선 처리한다.
- 없으면 사용자가 지정한 파일/도메인을 분석한다.

### 2단계: 리팩토링 계획 수립

변경 전에 **타입 + 측정 기준 포함** 계획을 보여준다:

```
## 리팩토링 계획

### 1. MatchRepository - N+1 쿼리 해결
- **타입**: Performance
- **Before**: 요청 10건 조회 시 쿼리 11회 (1 + N)
- **After**: FETCH JOIN 으로 쿼리 1회
- **측정 기준**: 쿼리 수 11 → 1 (90% 감소)
- **영향 파일**: Repository 1개, Service 0개

### 2. MatchService - private @Transactional 분리
- **타입**: Structure
- **Before**: self-invocation 으로 트랜잭션 미적용
- **After**: 별도 빈으로 분리하여 프록시 경유
- **측정 기준**: 트랜잭션 정상 작동 보장
- **영향 파일**: 신규 빈 1개, 기존 Service 1개 수정

### 3. MatchOfferResponse - DTO record 변환
- **타입**: Readability
- **Before**: class + getter 30줄
- **After**: record 5줄
- **측정 기준**: 코드량 83% 감소
- **영향 파일**: DTO 1개, 사용처 0개 (호환)

→ 진행할까? (전부 / 번호 선택 / 수정)
```

### 3단계: 적용

사용자 확인 후 코드를 수정한다.

### 4단계: 검증

- 백엔드: `cd backend && ./gradlew check`
- 웹: `cd web && npm run lint && npm run build` (+ 필요 시 `npm run test`)
- 변경 요약:

```
## 리팩토링 완료

| # | 파일 | 타입 | Before | After |
|---|------|------|--------|-------|
| 1 | MatchRepository | Perf | 쿼리 11회 | 쿼리 1회 |
| 2 | MatchService | Structure | self-invocation | 별도 빈 |
| 3 | MatchOfferResponse | Readability | class 30줄 | record 5줄 |

→ `/test` 실행을 권장한다.
```

### 5단계: 문서화 제안

LocalNow 는 별도 리팩토링 기록 디렉토리를 두지 않는다(`docs/` flat 구조). 대신:

- 구조 결정을 뒤집은 리팩토링 → `docs/ADR.md` 에 새 ADR 추가하고 이전 ADR 의 트레이드오프 섹션에 "ADR-0XX 에서 재검토" 링크를 남긴다.
- 성능 개선은 커밋 본문 + PR 설명에 Before/After 측정값을 적는다. 별도 문서 금지.
- 디렉토리 구조가 바뀐 리팩토링 → `docs/ARCHITECTURE.md` 의 트리를 최신 상태로 동기화한다.

## 이 프로젝트의 리팩토링 규칙

### 백엔드 (`backend/`, `com.localnow`)

#### DTO → record 변환
- Response DTO → record 우선
- Request DTO → Jackson 역직렬화 + Bean Validation 동작 확인 후 적용
- 필드 10개 이상 + 빌더 필수인 경우는 제외

#### 쿼리 최적화
- `LIKE '%…%'` → 접두사 `LIKE '…%'` 또는 FULLTEXT. 단 MVP 에선 과한 최적화 지양.
- N+1 → FETCH JOIN 또는 `@BatchSize`
- 불필요한 `findAll()` → Cursor 기반 페이징 (API 규약)
- 주변 가이드 조회는 RDB 가 아닌 Redis GEO 로 유지 (ADR-002)

#### 동시성
- 매칭 확정: Redis 분산락 + DB 낙관적 락 (`@Version`) 조합 유지 (ADR-004)
- 결제 상태 전이: DB 트랜잭션 + 상태 머신 검증
- `@Transactional` 범위 최소화. 외부 호출은 `AFTER_COMMIT` 이벤트로 분리 (ADR-003)
- private 메서드의 `@Transactional` → 별도 빈으로 분리

#### 레거시 정리
- `RestTemplate` → `RestClient`
- `System.out.println` → SLF4J Logger (`@Slf4j`)
- 하드코딩된 문자열 enum 값 → enum 타입으로
- 컨트롤러 ↔ Repository 직접 참조 → Service 경유로 (CRITICAL)

### 웹 (`web/`)

#### 구조 개선
- Client Component 안에서 fetch 를 직접 호출 → `/api/**` Route Handler 경유로 변경 (CRITICAL)
- 전역 상태 라이브러리 도입 시도 → 서버 상태는 TanStack Query, 로컬 상태는 `useState` 로 유지 (ADR-010). 진짜 필요하면 ADR 먼저.
- 컴포넌트 안에 임시 API 타입 정의 → `web/src/types/api.ts` 로 이동 (CRITICAL)
- 거대한 Client Component → 쿼리 관련 로직을 custom hook (`useXxxQuery`) 으로 추출

#### 성능
- 반복 렌더 → `useMemo` / `useCallback` 은 측정 후 적용. 남용 금지.
- 큰 페이지를 Server Component 로 쪼개서 번들 축소
- `next/dynamic` + `ssr: false` 는 Leaflet 같은 브라우저 전용 라이브러리에만

#### 스타일
- Tailwind 클래스 중복이 3회 이상이면 `components/` 의 재사용 컴포넌트로 승격
- 색/간격은 `docs/UI_GUIDE.md` 토큰만. 임시 hex 를 하드코딩한 부분을 정리하는 건 유효한 리팩토링

## 워크플로우 연계

- `/review` Critical 항목 → `/refactor` 로 이어짐
- 리팩토링 완료 → `/test` 실행 권장
- 테스트 통과 → `/commit` 제안
- 구조/ADR 이 바뀌면 → `/docs` 로 문서 동기화 제안

## 제약

- 한 번에 너무 많은 파일을 수정하지 않는다 (최대 5~7개).
- 기능 변경 없이 구조만 개선한다 (refactor ≠ feat).
- 수정 전 반드시 사용자 확인을 받는다.
- 테스트가 있는 코드를 수정하면 테스트도 함께 확인한다.
- ADR 에 명시된 결정(예: 전역 상태 라이브러리 미도입, 유료 지도 API 금지, 실 PG 금지) 을 리팩토링이라는 이름으로 우회하지 마라. 필요하면 ADR 부터 먼저 바꾼다.
