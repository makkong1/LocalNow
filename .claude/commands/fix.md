# Troubleshooting Skill

## 트리거

사용자가 에러 해결, 버그 수정, 트러블슈팅을 요청할 때 실행한다.
에러 메시지, 스택 트레이스, "안 돼", "에러 나" 등의 표현이 포함된 경우.

## 동작 절차

### 1단계: 증상 수집

사용자에게 아래 정보를 확인한다 (이미 제공된 건 건너뛴다):

- **에러 메시지/스택 트레이스**: 정확한 에러 내용
- **재현 조건**: 어떤 동작을 했을 때 발생하는지
- **영향 범위**: 백엔드? 프론트엔드? 빌드? DB?

### 2단계: 재현 가능성 체크

수정 전에 **문제를 재현할 수 있는지** 확인한다:

```
## 재현 체크

- **재현 가능**: ✅ (매번 발생)
  → 코드에서 원인 추적 가능

- **재현 불가 (간헐적)**: ⚠️
  → 동시성/타이밍 문제 가능성
  → 로그 확인, 트랜잭션 격리 수준 점검 필요

- **재현 조건 불명**: ❓
  → 추가 정보 요청 (로그, 입력값, 시간대)
```

### 3단계: 원인 분석

#### 에러 유형별 분석 경로

| 에러 유형 | 확인 순서 |
|-----------|----------|
| 컴파일 에러 (Java) | 에러 메시지 → 해당 파일 → import/타입 확인 |
| 타입 에러 (TS) | `tsc` 출력 → 해당 파일 → `web/src/types/api.ts` 동기화 여부 |
| 런타임 에러 (백엔드) | 스택 트레이스 → 해당 라인 → 데이터 흐름 추적 |
| DB 에러 | 쿼리 확인 → JPA 매핑 → Flyway 마이그레이션 → 인덱스/제약조건 |
| 인증 에러 | `config/SecurityConfig` → JWT 필터 → `/auth/**` 화이트리스트 → 웹의 HttpOnly 쿠키 전달 여부 |
| 웹 런타임 에러 | 브라우저 콘솔 → Route Handler 로그 → 백엔드 로그 순으로 하향 추적 |
| WebSocket 에러 | STOMP 연결 URL → 인증 핸드셰이크 → 구독 권한(`ChannelInterceptor`) → 메시지 포맷 |
| 빌드 에러 | Gradle(백엔드) / `next build`(웹) 로그 → 의존성 → 설정 파일 |
| 동시성 에러 | 분산락 획득/해제 → DB 낙관적 락 버전 → 트랜잭션 범위 |
| 메시지 유실 | RabbitMQ 발행 시점(`AFTER_COMMIT` 여부) → 큐/라우팅 키 오타 → DLQ 설정 |

#### LocalNow 에서 예상되는 빈출 에러 패턴

| 증상 | 가능한 원인 | 분류 |
|------|------------|------|
| `Could not resolve placeholder 'jwt.secret'` | `application-local.yml` 누락 또는 환경변수 미설정 | 설정 |
| `Access denied for user` (MySQL) | docker-compose 계정과 `application-local.yml` 불일치 | DB |
| `Flyway migration failed: checksum mismatch` | 기존 마이그레이션 파일을 수정함. 되돌리고 새 V 파일을 추가 | DB |
| `Connection refused` (6379 / 5672) | `docker compose up -d` 미실행 또는 포트 충돌 | 설정 |
| N+1 쿼리 | `@ManyToOne(fetch = EAGER)` 기본값, `fetch join` 누락 | 성능 |
| `@Transactional` 미작동 | private 메서드, self-invocation, non-Spring bean | 트랜잭션 |
| `ObjectOptimisticLockingFailureException` | `@Version` 충돌. 매칭 확정 동시 진입 | 동시성 |
| `MATCH_ALREADY_CONFIRMED` 가 아닌 500 반환 | 분산락은 잡았지만 예외→ErrorCode 매핑 누락 | 계약 |
| STOMP 구독은 되는데 메시지 미수신 | `/topic` vs `/app` prefix 혼동, `enableSimpleBroker` 설정 | WebSocket |
| 웹에서 401 반복 | HttpOnly 쿠키 미전달(SameSite/Secure 부적절), Route Handler 에서 `credentials: 'include'` 누락 | 인증 |
| `fetch is not defined` / 런타임 에러 | Server Component 에서 써야 할 코드를 Client 로 옮김 (또는 반대) | 웹 구조 |
| Leaflet 맵이 빈 화면 | SSR 에서 `window` 접근 → `next/dynamic({ ssr: false })` 누락 | 웹 구조 |
| `Hydration failed` | Server/Client 렌더 불일치. `Date.now()` / `Math.random()` 사용 | 웹 구조 |
| RabbitMQ 이벤트 유실 | `AFTER_COMMIT` 직후 발행 실패 → 로그 확인, 필요 시 Outbox 검토 (ADR-003) | 메시징 |

### 4단계: 해결책 2단계 제시

**반드시 빠른 해결과 근본 해결 두 가지를 모두 제시한다:**

```
## 원인 분석

**문제**: (한 줄 요약)
**원인**: (근본 원인 설명)
**증거**: (코드 또는 로그에서 확인한 근거)
**재현**: ✅ 가능 / ⚠️ 간헐적 / ❓ 미확인

## 해결 방법

### ⚡ 빠른 해결 (Hotfix)
- **소요**: 수정 1~2줄
- **효과**: 즉시 에러 해소
- **한계**: 근본 원인 미해결, 재발 가능
- **코드**:
  ```java
  // 수정 코드
  ```

### 🔧 근본 해결 (Proper Fix)
- **소요**: 파일 N개 수정
- **효과**: 원인 제거, 재발 방지
- **코드**:
  ```java
  // 수정 코드
  ```

→ 어떤 방법으로 수정할까? (빠른 / 근본 / 둘 다)
```

### 5단계: 수정 적용

사용자 선택 후 코드를 수정한다.

### 6단계: 검증

| 수정 대상 | 검증 방법 |
|----------|----------|
| 백엔드 코드 | `cd backend && ./gradlew compileJava` (최소) → `./gradlew check` (권장) |
| 웹 코드 | `cd web && npm run lint && npm run build` |
| DB / 마이그레이션 | Flyway 가 새 V 파일로 성공하는지, `ddl-auto=validate` 통과하는지 |
| 외부 연동 변경 | Testcontainers 기반 통합 테스트 추가 권장 |
| 동시성 관련 | `/test` 실행 제안 (동시성 테스트 패턴 포함) |

### 7단계: 문서화 제안

반복될 수 있는 문제는 기록을 제안한다. LocalNow 의 `docs/` 는 flat 구조라 별도 트러블슈팅 파일을 만들지 않는다. 대신:

- 규약을 어겼던 케이스(예: 새 에러 코드 누락) → `docs/API_CONVENTIONS.md` 의 해당 표를 갱신
- 구조 결정을 뒤집은 케이스(예: 락 전략 변경) → `docs/ADR.md` 에 새 ADR 추가
- 단순 버그 수정은 문서화 불필요. 커밋 메시지로 충분

## 워크플로우 연계

- 버그 수정 후 → `/test` 실행 (회귀 방지)
- 테스트 통과 → `/commit` 제안
- 반복 문제 → `/docs` 트러블슈팅 기록 제안

## 제약

- 추측으로 수정하지 않는다. 원인을 코드에서 확인한 후에 수정한다.
- 에러와 무관한 코드는 건드리지 않는다.
- 빠른 해결(Hotfix) 적용 시 TODO 주석으로 근본 해결 필요성을 표시한다.
