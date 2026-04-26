# LocalNow

여행자가 "지금 이 순간" 필요한 현지 가이드/통역/응급 지원을 실시간으로 매칭하는 플랫폼.
이 저장소는 **Spring Boot 백엔드 + React Native(Expo) 모바일 앱** 을 Claude Code 하네스로 단계별 구축한다.
백엔드 API + 웹 데모 클라이언트(0-mvp) 는 완료, 모바일 앱(1-mobile-app) 이 진행 중이다.

## 왜 이 프로젝트인가

단일 CRUD 포트폴리오가 아니라, 백엔드의 핵심 주제들을 하나의 도메인에서 동시에 증명하고, 그 결과를 실제 모바일 화면에서 시연하는 걸 목표로 한다.

- 실시간 처리 (WebSocket 채팅, 매칭 브로드캐스트)
- 위치 기반 검색 (Redis GEO)
- 비동기 이벤트 (RabbitMQ)
- 동시성 제어 (분산락 + 낙관적 락, 매칭 확정 충돌)
- 결제 상태 머신 (Mock PG 로 실제 흐름만 재현)
- 테스트 전략 (Testcontainers 기반 통합 테스트)
- **모바일 앱** (iOS / Android, 여행자와 가이드가 실기기에서 매칭과 채팅을 라이브로 시연)

자세한 제품 정의는 [`docs/PRD.md`](docs/PRD.md), 설계 결정은 [`docs/ADR.md`](docs/ADR.md) 를 본다.

## 기술 스택

### Backend (`backend/`)

| 영역        | 선택                                                                               |
| ----------- | ---------------------------------------------------------------------------------- |
| 언어/런타임 | Java 21                                                                            |
| 프레임워크  | Spring Boot 3.3 (Web, Security, Validation, Data JPA, Data Redis, AMQP, WebSocket) |
| 빌드        | Gradle 8 (Groovy DSL)                                                              |
| 데이터      | MySQL 8 + Flyway                                                                   |
| 캐시/GEO/락 | Redis 7                                                                            |
| 메시징      | RabbitMQ 3                                                                         |
| 실시간      | STOMP over WebSocket                                                               |
| 인증        | JWT (stateless)                                                                    |
| 테스트      | JUnit 5, AssertJ, Spring Boot Test, Testcontainers                                 |

### Mobile (`mobile/`) — 진행 중

| 영역       | 선택                                                                     |
| ---------- | ------------------------------------------------------------------------ | --- | ------ | --------------------------------------------------- |
| 프레임워크 | React Native 0.76 (New Architecture) + Expo SDK 52                       |
| 언어       | TypeScript (strict)                                                      |
| 스타일     | NativeWind v4 (Tailwind CSS 문법)                                        |
| 서버 상태  | TanStack Query v5                                                        |     | 실시간 | `@stomp/stompjs` + Native WebSocket (SockJS 불필요) |
| 지도       | `react-native-maps` + OpenStreetMap (API 키 불필요)                      |
| GPS        | `expo-location`                                                          |
| 인증       | `expo-secure-store` (iOS Keychain / Android Keystore) + 백엔드 직접 호출 |
| 내비게이션 | React Navigation v6 (Stack + Bottom Tab)                                 |
| 테스트     | Jest + React Native Testing Library                                      |

### Web (`web/`) — 0-mvp 참조 구현

| 영역       | 선택                                                           |
| ---------- | -------------------------------------------------------------- |
| 프레임워크 | Next.js 15 (App Router) + React 19                             |
| 언어       | TypeScript (strict)                                            |
| 스타일     | Tailwind CSS 4                                                 |
| 서버 상태  | TanStack Query v5                                              |
| 실시간     | `@stomp/stompjs` + SockJS                                      |
| 지도       | Leaflet + react-leaflet (OpenStreetMap, API 키 불필요)         |
| 인증       | HttpOnly 쿠키 + BFF 프록시 (Route Handler)                     |
| 테스트     | Vitest + React Testing Library, Playwright (핵심 시나리오 1개) |

## 백엔드 JPA 엔티티 (`backend/…/domain/`)

MySQL + JPA. 관계는 FK 대부분을 **Long id**로만 들고, 필요 시 조인은 서비스/리포지토리 쿼리로 처리한다.

| 엔티티 | DB 테이블 | 역할 |
| ------ | ---------- | ---- |
| `User` | `users` | 이메일·이름·`UserRole`·도시/언어·가이드 평균 별점(`avg_rating`/`rating_count`). 비밀번호 null 이면 OAuth 전용 계정. |
| `UserOAuthIdentity` | `user_oauth_identities` | 외부 IdP(예: Google) `provider` + `provider_user_id` ↔ 로컬 `user_id` 연결. |
| `HelpRequest` | `help_requests` | 여행자(`traveler_id`)·위치·요청 유형·예산·`HelpRequestStatus`·`@Version` 낙관적 락. |
| `MatchOffer` | `match_offers` | 요청(`request_id`)에 대한 가이드(`guide_id`) 제안, `MatchOfferStatus`. |
| `ChatRoom` | `chat_rooms` | 요청당 1방(`request_id` unique)·여행자/가이드 id. |
| `ChatMessage` | `chat_messages` | 방·발신자·본문·`client_message_id`(멱등). |
| `PaymentIntent` | `payment_intents` | 요청당 1건(`request_id` unique)·payer/payee·금액·수수료/가이드 정산·`PaymentStatus`·Mock PG id·멱등키. |
| `Review` | `reviews` | 요청당 1건(`request_id` unique)·리뷰어/리뷰이·별점·코멘트. |

**열거형(도메인, 테이블 컬럼이 아님)** — `UserRole`, `RequestType`, `HelpRequestStatus`, `MatchOfferStatus`, `PaymentStatus`, `OAuth2ProviderType` 등. 스키마는 Flyway `backend/src/main/resources/db/migration/` 에 정의.

## Phase 현황

| Phase        | 이름             | 상태       | 내용                                          |
| ------------ | ---------------- | ---------- | --------------------------------------------- |
| 0-mvp        | 백엔드 + 웹 데모 | ✅ 완료    | Spring Boot API 전체 도메인 + Next.js 데모 웹 |
| 1-mobile-app | React Native 앱  | 🔄 진행 중 | iOS/Android 모바일 클라이언트                 |

### 0-mvp 포함 범위 (완료)

- **서버**: 회원가입/로그인 · 위치 기반 도움 요청 · 주변 가이드 매칭(제안 → 확정) · 실시간 채팅 · 결제 흐름(Mock PG) · RabbitMQ 이벤트 · 평점/리뷰.
- **웹**: 로그인/회원가입 · 여행자 뷰(요청 생성, 후보 목록, 확정, 결제, 채팅) · 가이드 뷰(가용 토글, 요청 수락, 채팅) · 공통 채팅 패널.

### 1-mobile-app 포함 범위 (진행 중)

- **모바일 앱**: 로그인/회원가입 · 여행자 화면(GPS 기반 요청, 지도, 오퍼 선택, 확정) · 가이드 화면(온듀티 토글, 주변 요청 목록, 수락) · 실시간 채팅(STOMP) · Mock 결제 · 리뷰.

### 전 phase 제외

실시간 번역 API · 긴급 AI 챗봇 · 실제 PG 연동 · 추천 시스템 · 광고/보험 제휴 · i18n · Admin 화면.

근거는 [`docs/PRD.md`](docs/PRD.md), [`docs/ADR.md`](docs/ADR.md) 참고.

## 디렉토리

```
localNow/
├── README.md                 # (이 파일)
├── docker-compose.yml        # mysql / redis / rabbitmq (로컬 전용)
├── backend/                  # Spring Boot API 서버 (0-mvp 완료)
├── mobile/                   # React Native (Expo) 모바일 앱 (1-mobile-app 진행 중)
├── web/                      # Next.js 데모 웹 (0-mvp 참조 구현)
├── docs/
│   ├── PRD.md                # 제품 정의, 사용자, MVP 범위
│   ├── ARCHITECTURE.md       # 디렉토리 구조, 계층 / 패턴 / 데이터 흐름
│   ├── ADR.md                # 설계 결정과 트레이드오프 (ADR-001 ~ ADR-013)
│   ├── API_CONVENTIONS.md    # HTTP/WebSocket 응답 포맷, 에러 코드
│   └── UI_GUIDE.md           # 디자인 토큰 / 금지 패턴
├── pr-docs/
│   ├── 개선사항.md            # 0-mvp 분석 — 백엔드/웹 개선 포인트, 모바일 전환 고려사항
│   └── 도메인/               # 백엔드 도메인별 리뷰 문서
```

## 로컬 개발

```bash
# 1. 로컬 인프라
docker compose up -d

# 2. 백엔드
cd backend && ./gradlew check          # 컴파일 + 테스트
cd backend && ./gradlew bootRun        # http://localhost:8080

# 3. 모바일 앱 (새 터미널)
cd mobile && npm install
cd mobile && npx expo start            # Metro 서버 → Expo Go 앱 또는 시뮬레이터로 접속
# iOS 시뮬레이터: cd mobile && npx expo run:ios
# Android 에뮬레이터: cd mobile && npx expo run:android

# 4. 웹 참조 구현 (선택)
cd web && npm install
cd web && npm run dev                  # http://localhost:3000
# 관리자 읽기 전용 대시보드: http://localhost:3000/admin (시드 계정 `docs/ADR-014` 참고)

# 정리
docker compose down -v
```

## 시연 시나리오 (포트폴리오용)

### 모바일 앱 (1-mobile-app 완료 후)

1. iOS 시뮬레이터 A: 여행자 계정 로그인 → TravelerScreen 에서 GPS 위치 기반으로 "2시간 맛집 가이드" 요청 생성.
2. iOS 시뮬레이터 B: 가이드 계정 로그인 → GuideScreen 에서 온듀티 토글 ON → 새 요청 카드가 실시간으로 나타남 → 수락.
3. 시뮬레이터 A: 수락 카드 → "이 가이드로 확정" → Mock 결제 → 채팅 화면 활성화.
4. 양쪽 시뮬레이터에서 채팅 메시지 교환 → 양방향 실시간 표시.
5. 동시성 데모: 두 가이드가 동시에 수락했다가 여행자가 한쪽만 확정 → 나머지는 `MATCH_ALREADY_CONFIRMED` 수신.

### 웹 참조 구현 (0-mvp)

1. Chrome 탭 A: 여행자 계정 로그인 → `/traveler` 에서 도움 요청 생성.
2. Chrome 탭 B: 가이드 계정 로그인 → `/guide` 에서 가용 토글 ON → 요청 수락.
3. 탭 A: 가이드 확정 → Mock 결제 → 채팅 패널 활성화 → 양방향 실시간 채팅.

## 품질 기준

- 백엔드: `./gradlew check` 통과.
- 모바일: `npm test && npm run lint` 통과.
- 웹: `npm run lint && npm run build` 통과.
- 각 step 은 [`.claude/commands/review.md`](.claude/commands/review.md) 체크리스트로 셀프 리뷰.
- `CLAUDE.md` 의 CRITICAL 규칙(컨트롤러 → Repository 직접 호출, JWT AsyncStorage 저장 등) 위반 시 리뷰 단계에서 반려.

## 라이선스

포트폴리오 목적의 개인 프로젝트. 별도 라이선스 파일 없음.
