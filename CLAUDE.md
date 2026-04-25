# 프로젝트: LocalNow

여행 중 실시간으로 현지 가이드/통역/응급 지원을 매칭하는 플랫폼.
백엔드 API 서버(0-mvp 완료)와 모바일 네이티브 앱(1-mobile-app 진행 중)으로 구성된다.
웹 데모 클라이언트(`web/`)는 0-mvp에서 완성된 참조 구현으로 유지한다.

## 저장소 레이아웃

```
localNow/
├── backend/    # Spring Boot API 서버 (완료)
├── mobile/     # React Native (Expo) 모바일 앱 (여행자 + 가이드)
├── web/        # Next.js 데모 웹 (0-mvp 참조 구현, 유지)
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

### Mobile (`mobile/`)

- React Native 0.76 (New Architecture) + Expo SDK 52
- TypeScript strict mode
- NativeWind v4 (Tailwind CSS 문법으로 RN 스타일링)
- TanStack Query v5 (서버 상태)
- `@stomp/stompjs` 로 백엔드 WebSocket 직접 연결 (Native WebSocket, SockJS 불필요)
- `react-native-maps` + OpenStreetMap 타일 (지도. API 키 불필요)
- `expo-location` (기기 GPS 접근)
- `expo-secure-store` (JWT 저장. AsyncStorage 금지)
- React Navigation v6 (Stack + Bottom Tab)
- 테스트: Jest + React Native Testing Library

## 아키텍처 규칙

### 백엔드

- CRITICAL: 컨트롤러는 요청 검증과 응답 매핑만 한다. 비즈니스 로직은 반드시 `service/` 계층에서 처리한다. 컨트롤러가 Repository 를 직접 호출하는 것을 금지한다.
- CRITICAL: 외부 시스템(DB, Redis, RabbitMQ, 외부 API) 접근은 `infra/` 또는 `repository/` 계층을 통해서만 한다. 서비스가 `JdbcTemplate`, `RestTemplate`, `RabbitTemplate` 을 직접 들고 다니지 않는다.
- CRITICAL: 돈(결제·수수료)과 매칭 확정은 트랜잭션 경계 안에서만 상태를 바꾼다. 매칭 수락/확정은 낙관적 락 또는 Redis 분산락으로 동시성 제어를 반드시 한다.
- CRITICAL: 외부에 노출되는 DTO 와 도메인 엔티티를 섞지 않는다. 컨트롤러 입출력은 `dto/` 전용 타입을 사용한다.
- CRITICAL: 비밀번호·JWT 시크릿·외부 API 키는 코드/테스트/커밋 어디에도 하드코딩하지 않는다. 환경변수 또는 `application-local.yml`(gitignore) 에서 읽는다.
- 패키지 루트는 `com.localnow`. 도메인 단위로 모듈을 나눈다 (user, request, match, chat, payment, notification).
- 모든 public API 응답은 `docs/API_CONVENTIONS.md` 의 공통 응답 포맷을 따른다.

### 모바일

- CRITICAL: JWT 는 반드시 `expo-secure-store` 에만 저장한다. `AsyncStorage`, 전역 변수, 환경변수에 토큰을 담지 않는다. 이유: 기기 탈취 시 토큰 노출 방지.
- CRITICAL: 백엔드 API 를 직접 호출하는 단일 `mobile/src/lib/api-client.ts` 를 사용한다. 컴포넌트에서 `fetch`/`axios` 를 직접 호출하지 않는다.
- CRITICAL: 백엔드 베이스 URL(`EXPO_PUBLIC_API_BASE_URL`)은 `.env.local`(gitignore)에서만 읽는다. 코드에 하드코딩하지 않는다.
- CRITICAL: API 응답 타입은 `mobile/src/types/api.ts` 에서만 정의한다. `docs/API_CONVENTIONS.md` 계약과 1:1 대응. 컴포넌트 안에서 임시 인터페이스 재정의 금지.
- CRITICAL: 외부 서비스(실 PG, 번역 API, OAuth) 실연동은 이 phase 에서 금지한다. 인터페이스만 만들고 Mock 구현으로 대체한다.
- CRITICAL: `EXPO_PUBLIC_*` 값은 앱 번들에 노출된다. 백엔드 URL 같은 공개 설정만 넣고 JWT, API key, secret은 절대 넣지 않는다.
- 화면 단위 컴포넌트는 `mobile/src/screens/` 하위에 둔다. 재사용 UI 는 `mobile/src/components/` 하위에 둔다.
- 서버 상태는 TanStack Query. 클라이언트 상태는 `useState/useReducer`. 전역 상태 라이브러리(Zustand/Redux/Jotai) 도입 금지.
- 디자인 원칙은 `docs/UI_GUIDE.md` 를 따른다. 다크 테마, amber/orange 포인트 컬러 고정. 보라 그라데이션 / glow / 애니메이션 과용 금지.

## 개발 프로세스

- CRITICAL: 새 기능 구현 시 테스트를 먼저 작성(TDD)하고, 통과하는 최소 구현을 작성한다. 백엔드 서비스는 단위 테스트, 외부 시스템 연동은 Testcontainers, 모바일 핵심 컴포넌트는 RNTL.
- CRITICAL: 외부 서비스(실 PG, 번역, 지도 API 키, OAuth) 실연동 금지. 인터페이스만 만들고 Mock 구현으로 대체. 필요 시점에 ADR 추가 후 도입.
- 커밋 메시지는 conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). 스코프에는 `backend` / `mobile` / `web` / `docs` 중 하나를 권장.
- 매 step 완료 후 아래 "명령어" 섹션의 검증을 반드시 통과시킨다.

## 명령어

```bash
# --- backend ---
cd backend && ./gradlew check         # 컴파일 + 정적분석 + 테스트
cd backend && ./gradlew bootRun       # 서버 실행 (docker compose up 선행)

# --- mobile ---
cd mobile && npx expo start           # Metro 개발 서버 (Expo Go 또는 시뮬레이터)
cd mobile && npx expo run:ios         # iOS 시뮬레이터 빌드 (Xcode 필요)
cd mobile && npx expo run:android     # Android 에뮬레이터 빌드 (Android Studio 필요)
cd mobile && npm run lint             # ESLint
cd mobile && npm test                 # Jest

# --- web (참조용) ---
cd web && npm run dev                 # 개발 서버 (http://localhost:3000)
cd web && npm run build               # 프로덕션 빌드 확인

# --- 로컬 인프라 ---
docker compose up -d                  # mysql / redis / rabbitmq
docker compose down -v                # 정리
```
