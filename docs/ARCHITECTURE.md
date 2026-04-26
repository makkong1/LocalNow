# 아키텍처

## 저장소 구조
```
localNow/
├── backend/                       # Spring Boot API 서버
│   ├── build.gradle
│   ├── settings.gradle
│   └── src/
│       ├── main/
│       │   ├── java/com/localnow/
│       │   │   ├── LocalNowApplication.java
│       │   │   ├── config/              # Security, WebSocket, Redis, RabbitMQ, OpenAPI
│       │   │   ├── common/              # ApiResponse, ErrorCode, security (AuthenticationUserRoles), Clock 등
│       │   │   ├── user/                # 도메인: 사용자/인증
│       │   │   │   ├── controller/
│       │   │   │   ├── service/
│       │   │   │   ├── domain/          # JPA 엔티티 + 도메인 로직
│       │   │   │   ├── repository/
│       │   │   │   └── dto/
│       │   │   ├── request/             # 도메인: 도움 요청 (HelpRequest)
│       │   │   ├── match/               # 도메인: 가이드 제안/확정 (MatchOffer, 분산락)
│       │   │   ├── chat/                # 도메인: 채팅방 + 메시지 영속화
│       │   │   ├── payment/             # 도메인: 결제 의도/수수료 분배 (Mock PG)
│       │   │   ├── notification/        # 도메인: RabbitMQ 이벤트 소비/발행
│       │   │   ├── admin/               # 도메인: 읽기 전용 집계 대시보드 (ADR-014)
│       │   │   │   ├── controller/
│       │   │   │   ├── service/
│       │   │   │   └── dto/
│       │   │   └── infra/
│       │   │       ├── redis/           # RedisTemplate 래퍼, GEO 조회
│       │   │       ├── rabbit/          # Exchange/Queue 선언, Publisher
│       │   │       ├── pg/              # PaymentGateway 인터페이스 + MockPaymentGateway
│       │   │       └── translator/      # Translator 인터페이스 + PassThroughTranslator
│       │   └── resources/
│       │       ├── application.yml
│       │       ├── application-local.yml      # gitignore
│       │       └── db/migration/              # Flyway V1__init.sql ...
│       └── test/
│           ├── java/com/localnow/
│           └── resources/
├── mobile/                        # React Native (Expo) 모바일 클라이언트
│   ├── package.json
│   ├── app.json                   # Expo 설정
│   ├── babel.config.js
│   ├── tsconfig.json
│   ├── .env.local                 # gitignore — EXPO_PUBLIC_API_BASE_URL
│   └── src/
│       ├── navigation/
│       │   ├── RootNavigator.tsx  # 인증 여부에 따라 Auth/App Stack 분기
│       │   ├── AuthNavigator.tsx  # Login, Signup
│       │   └── AppNavigator.tsx   # Bottom Tab: Traveler | Guide
│       ├── screens/
│       │   ├── LoginScreen.tsx
│       │   ├── SignupScreen.tsx
│       │   ├── TravelerScreen.tsx  # 요청 생성, 지도, 오퍼 선택
│       │   ├── GuideScreen.tsx     # 온듀티 토글, 주변 요청 목록
│       │   ├── ChatScreen.tsx      # 채팅 (STOMP)
│       │   ├── PaymentScreen.tsx   # 결제 의도 생성·캡처 (Mock PG)
│       │   └── ReviewScreen.tsx    # 완료 후 가이드 리뷰 작성
│       ├── components/
│       │   ├── RequestForm.tsx
│       │   ├── GuideOfferCard.tsx
│       │   ├── RequestCard.tsx
│       │   ├── ChatBubble.tsx
│       │   ├── StatusBadge.tsx
│       │   ├── OnDutyToggle.tsx    # 가이드 온듀티 토글 버튼
│       │   ├── ReviewForm.tsx      # 별점·코멘트 입력 폼
│       │   └── LocationMap.tsx     # react-native-maps 래퍼
│       ├── lib/
│       │   ├── api-client.ts       # fetch 래퍼 (SecureStore에서 JWT 로드, 직접 백엔드 호출)
│       │   ├── stomp-client.ts     # @stomp/stompjs Native WebSocket 클라이언트
│       │   └── secure-storage.ts   # expo-secure-store 래퍼 (getToken/setToken/clearToken)
│       ├── hooks/
│       │   ├── useAuth.tsx         # 로그인 상태, 토큰 관리
│       │   ├── useRealtime.ts      # STOMP 구독 관리
│       │   ├── useRequests.ts      # 도움 요청 목록·단건 조회
│       │   ├── useMatches.ts       # 오퍼 수락·확정
│       │   ├── useGuide.ts         # 온듀티 토글·주변 요청 조회
│       │   ├── usePayment.ts       # 결제 의도 생성·캡처
│       │   ├── useReview.ts        # 리뷰 작성
│       │   └── useChat.ts          # 채팅 메시지 히스토리
│       ├── __tests__/              # Jest + RNTL 단위 테스트
│       └── types/
│           └── api.ts              # API_CONVENTIONS.md 계약과 1:1 대응
├── web/                           # Next.js 데모 클라이언트 (0-mvp 참조 구현)
│   └── src/
│       └── app/
│           ├── admin/             # 관리자 대시보드 페이지 (ADMIN 역할 전용)
│           └── api/admin/         # 백엔드 /admin/** 프록시 Route Handler
├── docs/
├── scripts/
├── phases/
└── docker-compose.yml             # mysql / redis / rabbitmq (로컬 전용, 루트)
```

모든 백엔드 도메인 모듈은 동일 구조(`controller / service / domain / repository / dto`)를 따른다. 벗어나는 경우 ADR 로 근거를 남긴다.

## 패턴

### 백엔드
- **HTTP 역할 검사**: JWT → `ROLE_TRAVELER` / `ROLE_GUIDE`. 엔드포인트별 허용 역할은 컨트롤러에서 `AuthenticationUserRoles` 로 거르고(미통과 시 `AUTH_FORBIDDEN`), 요청/결제/매칭 단건 접근은 서비스에서 당사자·상태를 재검증한다.
- **계층형 (Controller → Service → Repository/Infra)** 기본. 헥사고날은 MVP 에서 과하다.
- **도메인 주도 패키지 분리**: 기술 계층보다 도메인(user, request, match, ...)을 상위 경계로 둔다. 도메인 간 참조는 서비스 인터페이스로만.
- **이벤트 기반 결합 분리**: 매칭 확정 / 채팅 도착 / 결제 완료처럼 후속 부수효과는 `@TransactionalEventListener(AFTER_COMMIT)` 로 받아 RabbitMQ 발행. 유실이 치명적인 도메인은 이후 Outbox 로 승격 (ADR-006 참고).
- **동시성 제어**:
  - 매칭 확정(`confirm`): 요청 단위 Redis 분산락(`setIfAbsent` 5초 TTL + Lua 원자 해제) 을 먼저 획득 후 `TransactionTemplate` 으로 DB 트랜잭션 실행. DB 는 `PESSIMISTIC_WRITE` 락으로 이중 보호.
  - 결제 상태 전이: DB 트랜잭션 + 도메인 상태 머신 검증(`PaymentIntent.capture()`).
  - 매칭 수락(`accept`): 멱등 설계 — 동일 (requestId, guideId) 로 재호출하면 기존 레코드 반환.
- **테스트 전략**:
  - 서비스 단위 테스트: 순수 JUnit + Mockito.
  - Repository·Redis·Rabbit·WebSocket: Testcontainers.
  - 컨트롤러: `@WebMvcTest` 로 계약 검증.

### 웹 (0-mvp 참조 구현)
- **Server Component 기본, Client Component 는 꼭 필요한 곳만**. 인터랙션이 필요한 컴포넌트만 `components/client/` 하위에서 `"use client"`.
- **BFF 패턴**: 브라우저는 `web/src/app/api/**` Route Handler 에만 접근한다. Route Handler 가 JWT 를 HttpOnly 쿠키에서 꺼내 붙여 백엔드로 프록시한다. 브라우저 번들에 `API_BASE_URL` 같은 값이 노출되지 않는다. 단, BFF 는 백엔드 공식 API 를 감싸는 얇은 adapter 이며 웹 전용 비즈니스 계약을 만들지 않는다.
- **WebSocket 프록시**: Next.js 는 STOMP 를 직접 relay 하지 않고, 브라우저 STOMP.js 클라이언트가 백엔드 WebSocket 엔드포인트에 직접 붙는다. 단, 연결 URL 은 Route Handler 가 짧은 수명 토큰과 함께 발급하는 방식을 기본으로 한다(토큰 노출 최소화).
- **데이터 페칭**: Server Component 에서는 `api-client.ts` 로 직접 fetch. Client Component 에서는 TanStack Query 로 `/api/*` 호출.
- **스타일**: Tailwind 토큰을 `UI_GUIDE.md` 에 맞춰 제한적으로 사용. 컴포넌트 단위로 재사용 가능한 스타일만 추출.
- **테스트**: Vitest + RTL 로 컴포넌트 단위, Playwright 로 "로그인 → 여행자 요청 생성 → 가이드 수락 → 확정 → 채팅 1회" 시나리오를 단 한 개 e2e 로.

### 모바일 (1-mobile-app)
- **백엔드 직접 호출**: BFF 없음. `api-client.ts` 가 `EXPO_PUBLIC_API_BASE_URL` 베이스로 백엔드를 직접 호출한다. JWT 는 요청 헤더에 `Authorization: Bearer <token>` 으로 첨부 (ADR-012). 호출하는 HTTP resource, DTO, error code 는 웹 BFF 가 proxy 하는 백엔드 공식 API 와 동일하다.
- **보안 스토리지**: `expo-secure-store` 로 JWT 저장. iOS Keychain / Android Keystore 를 OS 레벨에서 사용. `AsyncStorage` 는 평문 저장이므로 금지 (ADR-011).
- **Native WebSocket + STOMP**: `@stomp/stompjs` 를 SockJS 없이 사용. `webSocketFactory: () => new WebSocket(url)`. 백엔드에 `/ws-native` 엔드포인트 추가 필요 (SockJS 없는 순수 WebSocket 핸드셰이크) (ADR-013).
- **네비게이션**: React Navigation v6. 로그인 여부 → `RootNavigator` 분기. 앱 진입 시 `SecureStore` 에서 토큰 읽어 인증 상태 결정.
- **데이터 페칭**: TanStack Query v5. `queryClient.invalidateQueries` 로 STOMP 이벤트 수신 시 화면 갱신.
- **테스트**: Jest + RNTL 로 컴포넌트 단위 테스트. 핵심 시나리오(로그인 → 요청 생성 → 수락 → 확정 → 채팅)는 Detox e2e 또는 수동 시뮬레이터 검증.

### 웹/모바일 API 경계
- **공식 계약은 백엔드 하나**: `docs/API_CONVENTIONS.md` 의 endpoint 가 유일한 외부 계약이다.
- **웹 BFF 는 proxy/adapter**: 쿠키에서 JWT 를 읽고 백엔드 Bearer 호출로 변환한다. 웹 화면 편의를 위해 백엔드에 없는 데이터를 조합해 새 계약처럼 만들지 않는다.
- **모바일은 같은 계약 직접 호출**: `mobile/src/lib/api-client.ts` 가 같은 endpoint 를 호출하고, SecureStore 의 JWT 를 Bearer header 로 붙인다.
- **클라이언트별 차이는 저장소와 transport**: 웹은 HttpOnly cookie + SockJS `/ws`, 모바일은 SecureStore + Native WebSocket `/ws-native` 를 쓴다. STOMP destination 과 payload 는 동일하게 유지한다.

## 데이터 흐름

### 매칭
```
[브라우저: 여행자] ──POST /api/requests──▶ [Next Route Handler]
                                              │  (HttpOnly 쿠키에서 JWT 로드)
                                              ▼
                                          [Spring: RequestController] ─▶ RequestService
                                                                            ├─▶ HelpRequestRepository (MySQL)
                                                                            └─▶ RedisGeoIndex.add(request)

[RequestService] ──AFTER_COMMIT 이벤트──▶ MatchDispatcher
    MatchDispatcher: Redis GEOSEARCH 로 주변 가이드 조회
                      └─▶ RabbitMQ publish: match.offer.created (가이드별 큐)

[브라우저: 가이드] ──POST /api/requests/{id}/accept──▶ Next Route Handler ──▶ POST /requests/{id}/accept: MatchController ──▶ MatchService.accept
                                                                                                    (accept 자체는 멱등 저장; confirm 에서 Redis 분산락)

[브라우저: 여행자] ──POST /api/requests/{id}/confirm──▶ Next Route Handler ──▶ MatchController.confirm ──▶ MatchService
                                                          (body: guideId; Redis 분산락 + DB 트랜잭션으로 MATCHED 전이)
                                                          └─ 이후 흐름: 결제 의도/캡처 등은 `payment` 도메인
```

### 채팅
```
[브라우저] ──STOMP SEND /app/rooms/{roomId}/messages──▶ [Spring: StompChatController]
                                                          ├─ ChatService.sendMessage (clientMessageId 멱등 체크)
                                                          ├─ ChatMessageRepository.save
                                                          ├─ SimpMessagingTemplate.convertAndSend(/topic/rooms/{roomId})
                                                          └─ AFTER_COMMIT: RabbitMQ publish chat.message.sent

[브라우저: 상대] ──STOMP SUBSCRIBE /topic/rooms/{roomId}──▶ 메시지 수신 → ChatPanel 렌더
```

### 실시간 알림 (notification 도메인)
```
RabbitMQ
  match.notification 큐 ──▶ MatchNotificationListener
    match.offer.created  → /topic/guides/{guideId}    : { type:"NEW_REQUEST", requestId, requestType, budgetKrw }
    match.offer.accepted → /topic/requests/{requestId}: { type:"OFFER_ACCEPTED", guideId }
    match.confirmed      → /topic/guides/{guideId}    : { type:"MATCH_CONFIRMED", requestId }

  chat.notification 큐 ──▶ ChatNotificationListener
    chat.message.sent    → /topic/users/{receiverId}  : { type:"CHAT_MESSAGE", roomId, preview }

[브라우저: RealtimeProvider] ──STOMP SUBSCRIBE /topic/guides/{userId} or /topic/requests/{id}──▶
    NEW_REQUEST        → TanStack Query invalidateQueries(['nearbyRequests'])
    OFFER_ACCEPTED     → invalidateQueries(['offers', requestId])
    MATCH_CONFIRMED    → 토스트 알림
    CHAT_MESSAGE       → invalidateQueries(['chatRoom'])
```

## 상태 관리

### 백엔드
- 영속 상태: MySQL. Flyway 마이그레이션. `ddl-auto=validate`.
- 단기 상태(캐시·락·GEO): Redis. TTL 명시적.
- 비동기 큐: RabbitMQ. 토픽 exchange — `match.*`, `chat.*`. 큐: `match.notification`, `chat.notification`.
- 인증: JWT stateless. 세션/쿠키 없음(백엔드 관점).

### 웹
- 서버 상태: TanStack Query. 재시도·캐싱 규칙은 쿼리 키 단위로 명시.
- 클라이언트 상태: `useState/useReducer` 만. 전역 스토어 금지.
- 인증 상태: HttpOnly + Secure + SameSite=Lax 쿠키에 JWT 저장. 브라우저 JS 에서 읽지 못함. 로그아웃은 쿠키 제거.
- 실시간 상태: STOMP 연결·구독·메시지 누적은 `ChatPanel` 컴포넌트 로컬 상태로 유지. 전역 소켓 싱글톤은 두지 않는다(탭/페이지 단위로 연결).

## 관측성 (MVP 최소치)
- 백엔드: `spring-boot-starter-actuator` — `/actuator/health`, `/actuator/info`. 구조화 JSON 로그, `requestId` MDC.
- 웹: Next.js 기본 로그. 에러는 `console.error` + Route Handler 레벨에서 `requestId` 전파.
- 에러는 `docs/API_CONVENTIONS.md` 의 `ErrorCode` 로 표준화.
