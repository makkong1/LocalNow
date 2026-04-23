# 프로젝트: LocalNow

여행 중 실시간으로 현지 가이드/통역/응급 지원을 매칭하는 플랫폼.
MVP 는 "작동하는 최소한의 매칭 + 채팅 서버" 와 "한 화면에서 동작을 시연할 수 있는 웹 클라이언트" 를 함께 제공한다. 모바일 네이티브 앱은 MVP 범위 밖.

## 저장소 레이아웃
```
localNow/
├── backend/    # Spring Boot API 서버
├── web/        # Next.js 데모 웹 (여행자 뷰 + 가이드 뷰)
├── docs/
├── scripts/
└── phases/
```

## 기술 스택

### Backend (`backend/`)
- Java 17 (toolchain)
- Spring Boot 3.3 (Web, Security, Validation, WebSocket, AMQP, Data JPA, Data Redis)
- Gradle 8 (Groovy DSL)
- MySQL 8 + Flyway
- Redis 7 (GEO / 캐시 / 분산락)
- RabbitMQ 3
- STOMP over WebSocket
- JWT 인증 (stateless)
- 테스트: JUnit 5, AssertJ, Spring Boot Test, Testcontainers

### Web (`web/`)
- Next.js 15 (App Router) + React 19
- TypeScript strict mode
- Tailwind CSS 4
- TanStack Query v5 (서버 상태)
- STOMP.js (`@stomp/stompjs`) + SockJS 로 백엔드 WebSocket 연결
- Leaflet + react-leaflet (지도. Google Maps API 키 회피)
- 테스트: Vitest + React Testing Library, Playwright (핵심 시나리오만)

## 아키텍처 규칙

### 백엔드
- CRITICAL: 컨트롤러는 요청 검증과 응답 매핑만 한다. 비즈니스 로직은 반드시 `service/` 계층에서 처리한다. 컨트롤러가 Repository 를 직접 호출하는 것을 금지한다.
- CRITICAL: 외부 시스템(DB, Redis, RabbitMQ, 외부 API) 접근은 `infra/` 또는 `repository/` 계층을 통해서만 한다. 서비스가 `JdbcTemplate`, `RestTemplate`, `RabbitTemplate` 을 직접 들고 다니지 않는다.
- CRITICAL: 돈(결제·수수료)과 매칭 확정은 트랜잭션 경계 안에서만 상태를 바꾼다. 매칭 수락/확정은 낙관적 락 또는 Redis 분산락으로 동시성 제어를 반드시 한다.
- CRITICAL: 외부에 노출되는 DTO 와 도메인 엔티티를 섞지 않는다. 컨트롤러 입출력은 `dto/` 전용 타입을 사용한다.
- CRITICAL: 비밀번호·JWT 시크릿·외부 API 키는 코드/테스트/커밋 어디에도 하드코딩하지 않는다. 환경변수 또는 `application-local.yml`(gitignore) 에서 읽는다.
- 패키지 루트는 `com.localnow`. 도메인 단위로 모듈을 나눈다 (user, request, match, chat, payment, notification).
- 모든 public API 응답은 `docs/API_CONVENTIONS.md` 의 공통 응답 포맷을 따른다.

### 웹
- CRITICAL: 브라우저에서 백엔드를 직접 호출하지 않는다. 외부로 나가는 모든 HTTP 요청은 `web/src/app/api/**` 의 Route Handler 를 거친다. 토큰은 HttpOnly 쿠키로 서버에서 보관한다.
- CRITICAL: 기본값은 Server Component. 인터랙션/상태/이벤트가 필요한 파일만 상단에 `"use client"` 를 붙이고 `components/client/` 하위에 둔다.
- CRITICAL: API 응답 타입은 `web/src/types/api.ts` 에서만 정의하고, 이 타입은 `docs/API_CONVENTIONS.md` 계약과 1:1 로 대응한다. 서버 응답 형태를 컴포넌트 안에서 임시 타입으로 재정의하지 않는다.
- 디자인은 `docs/UI_GUIDE.md` 를 단일 기준으로 따른다. 거기서 금지한 AI 슬롭 패턴(보라 그라데이션, backdrop-blur, glow, gradient orb)을 만들지 않는다.
- 클라이언트 상태: `useState/useReducer` 기본. 서버 상태는 TanStack Query. 전역 상태 라이브러리(Zustand/Redux/Jotai) 도입 금지. 필요해지면 ADR 추가 후 도입.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 테스트를 먼저 작성(TDD)하고, 통과하는 최소 구현을 작성한다. 백엔드 서비스는 단위 테스트, 외부 시스템 연동은 Testcontainers, 웹 핵심 플로우는 Playwright.
- CRITICAL: 외부 서비스(실 PG, 번역, 지도 API 키, OAuth) 실연동은 MVP 에서 금지한다. 인터페이스만 만들고 Fake/Mock 구현으로 대체한다. 필요 시점에 ADR 추가 후 도입.
- 커밋 메시지는 conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). 스코프에는 `backend` / `web` / `docs` 중 하나를 권장.
- 매 step 완료 후 아래 "명령어" 섹션의 검증을 반드시 통과시킨다.

## 명령어
```bash
# --- backend ---
cd backend && ./gradlew check         # 컴파일 + 정적분석 + 테스트
cd backend && ./gradlew bootRun       # 서버 실행 (docker compose up 선행)

# --- web ---
cd web && npm run dev                 # 개발 서버 (http://localhost:3000)
cd web && npm run lint                # ESLint
cd web && npm run build               # 프로덕션 빌드
cd web && npm run test                # Vitest
cd web && npm run e2e                 # Playwright (선택)

# --- 로컬 인프라 ---
docker compose up -d                  # mysql / redis / rabbitmq
docker compose down -v                # 정리
```
