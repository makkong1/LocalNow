# Architecture Decision Records

## 철학
MVP 속도 최우선. 외부 의존성은 "정말 매칭/채팅/결제가 동작한다"를 보여줄 최소 수준만 붙인다.
작동하는 최소 구현을 선택하되, 포트폴리오로서 **실시간 처리 / 위치 기반 검색 / 채팅 / 결제 / 동시성** 다섯 가지 주제를 증명할 수 있는 설계는 포기하지 않는다. 과시용 기술은 거절하고 ADR 로 근거를 남긴다.

---

### ADR-001: Spring Boot 3.3 + Java 17
**결정**: Spring Boot 3.3, Java 17 (toolchain), Gradle 8 (Groovy DSL) 로 API 서버를 구축한다.
**이유**: 국내 백엔드 채용 시장·실무 레퍼런스가 가장 풍부하고, Security / Data JPA / AMQP / WebSocket 스타터가 모두 갖춰져 있어 MVP 속도가 제일 빠르다. Java 17 의 record / pattern matching / sealed class 는 코드 양을 줄여준다.
**트레이드오프**: Kotlin / Spring WebFlux 대비 비동기 표현력은 떨어진다. 대신 WebSocket·RabbitMQ 로 비동기 요구를 분리하고, 핵심 경로는 blocking MVC 로 단순하게 유지한다.

### ADR-002: 위치 기반 검색은 Redis GEO 를 쓴다 (MySQL Spatial 제외)
**결정**: 주변 가이드 조회는 Redis 의 `GEOADD` / `GEOSEARCH` 로 처리한다. MySQL 에는 가이드 최신 위치를 단순 컬럼으로만 저장한다.
**이유**: MVP 트래픽 수준에서 "내 근처 N km 가용 가이드" 쿼리는 Redis GEO 한 번이면 O(log N) 으로 끝난다. MySQL Spatial 인덱스는 튜닝 비용이 크고, 가이드 위치는 자주 바뀌기 때문에 TTL 있는 Redis 가 더 자연스럽다.
**트레이드오프**: Redis 장애 시 매칭 대상 조회가 실패한다 → 장애 시 "주변 검색 기능 일시 중단" 으로 fail-soft 하며, 완료된 매칭/결제 흐름은 Redis 없이도 동작한다.

### ADR-003: 비동기 알림·이벤트는 RabbitMQ 로 분리한다
**결정**: 매칭 제안 푸시, 채팅 미수신 알림, 결제 후처리 같은 부수효과는 `@TransactionalEventListener(AFTER_COMMIT)` 로 받아서 RabbitMQ 로 발행한다. 토픽 exchange + `match.*`, `chat.*`, `notification.*` 라우팅 키를 사용한다.
**이유**: 트랜잭션 안에서 외부 시스템 호출을 하면 롤백 시 유령 이벤트가 남거나, 외부 장애가 비즈니스 실패로 번진다. 발행을 커밋 이후로 미루고 큐에 맡기면 주 흐름이 얇아진다. Kafka 는 MVP 규모에서 과하다.
**트레이드오프**: AFTER_COMMIT 직후 발행 실패 시 이벤트 유실 가능. 유실이 치명적인 도메인(결제 정산)은 이후 Outbox 테이블 패턴으로 보강한다. ADR-006 으로 재검토.

### ADR-004: 실시간 채팅은 STOMP over WebSocket 단일 인스턴스로 시작
**결정**: Spring WebSocket + STOMP 내장 브로커(`enableSimpleBroker`)로 실시간 채팅을 구현한다. 외부 메시지 브로커(STOMP relay)는 MVP 범위 밖.
**이유**: 단일 서버 인스턴스에서 동작하는 MVP 스코프에서는 내장 브로커가 가장 단순하고 충분하다. 메시지 영속화는 RDB 에서 하므로 스케일링 전까지 메모리 브로커의 한계가 드러나지 않는다.
**트레이드오프**: 서버를 수평 확장하는 순간 동작하지 않는다. 스케일 아웃이 필요해지면 RabbitMQ STOMP plugin 또는 Redis pub/sub 기반 relay 로 전환 (별도 ADR).

### ADR-005: 결제는 Mock PaymentGateway 로 시작하고 실제 PG 는 붙이지 않는다
**결정**: `PaymentGateway` 인터페이스를 정의하고, MVP 에서는 항상 성공/실패를 제어할 수 있는 `MockPaymentGateway` 구현만 제공한다. 플랫폼 수수료 계산과 상태 머신(`AUTHORIZED → CAPTURED → REFUNDED`)은 실제처럼 구현한다.
**이유**: 실 PG 연동은 가맹점 등록·KYC·콜백 URL·운영 이슈가 크고, 포트폴리오에서 증명해야 할 "수수료 계산 / 상태 전이 / 멱등 캡처" 같은 핵심 로직과 무관하다. 외부 인증이 필요한 작업은 harness 에서 `blocked` 로 처리되어야 한다.
**트레이드오프**: 실제 결제가 되지 않는다. 추후 실 PG 연동은 인터페이스 교체만으로 가능하도록 계약(`PaymentGateway`)을 명확히 둔다.

### ADR-006: 외부 번역 API 는 MVP 에서 도입하지 않는다
**결정**: `Translator` 인터페이스를 두고, MVP 에서는 입력을 그대로 돌려주는 `PassThroughTranslator` 만 제공한다. 채팅 메시지에는 `locale` 메타만 기록해 추후 교체 대비.
**이유**: 번역 품질·비용·API 키 관리는 MVP 검증 대상이 아니다. 인터페이스만 확정되어 있으면 Google/DeepL 로 갈아끼우는 건 하루짜리 작업이다.
**트레이드오프**: 언어 장벽 해소라는 제품 가치 중 하나가 시연에서 빠진다. 대신 매칭·동시성·결제·실시간이라는 핵심 가치에 시간을 몰아준다.

### ADR-007: 데모 웹 클라이언트 = Next.js 15 (App Router) + Tailwind
**결정**: 시연용 웹 클라이언트를 Next.js 15 App Router + TypeScript strict + Tailwind + TanStack Query 스택으로 만든다. iOS/Android 네이티브 앱은 MVP 에서 제외.
**이유**:
1. 포트폴리오 시연에서 "버튼을 누르면 반대편 탭이 실시간으로 갱신되는 화면" 이 없으면 실시간/매칭의 가치가 리뷰어에게 전달되지 않는다.
2. Next.js App Router 의 Server Component + Route Handler 조합은 JWT 를 HttpOnly 쿠키로 서버에서 다루고 브라우저 번들에서 API URL 을 숨기기 쉽다. BFF 패턴을 추가 인프라 없이 얻는다.
3. React Native / Flutter 대비 배포가 정적 호스팅 한 번으로 끝나 공수가 훨씬 적다.
**트레이드오프**: 모바일 UX 는 1픽셀도 증명하지 못한다. 제품 컨셉상 아쉽지만, "MVP 작게" 원칙상 허용 가능한 손해로 본다. 추후 실제 모바일은 별도 리포지토리에서 React Native 로 확장.

### ADR-008: 지도는 Leaflet + OpenStreetMap (Google Maps / Mapbox 금지)
**결정**: 여행자/가이드 위치 표시는 `leaflet` + `react-leaflet` + OSM 타일로 구현한다. Google Maps, Mapbox, Kakao Maps 등 API 키가 필요한 지도는 MVP 에서 사용하지 않는다.
**이유**: API 키 / 결제 수단 등록이 harness 실행 중 `blocked` 를 유발한다. 현지 가이드 위치 시각화라는 기능 요구는 OSM 타일로도 충분히 충족된다.
**트레이드오프**: 교통 혼잡도, 장소 검색, Place Autocomplete 같은 고급 기능은 불가. MVP 범위에서는 불필요.

### ADR-009: 웹 인증은 HttpOnly 쿠키 + BFF 프록시
**결정**: 로그인 시 Next.js Route Handler 가 백엔드에서 받은 JWT 를 `HttpOnly; Secure; SameSite=Lax` 쿠키로 저장한다. 브라우저에서 토큰을 직접 읽지 못하며, 백엔드 호출은 항상 `/api/**` Route Handler 를 경유한다.
**이유**: `localStorage` 에 JWT 를 저장하는 흔한 안티패턴을 원천 차단. XSS 로 토큰이 새지 않는다. 포트폴리오에서 보안 의식을 드러낼 포인트.
**트레이드오프**: 모든 외부 호출이 Next 서버를 경유하므로 지연이 한 홉 더 생긴다. MVP 트래픽에서는 무시 가능한 수준.

### ADR-010: 웹 전역 상태 라이브러리 미도입
**결정**: Zustand / Redux / Jotai 같은 전역 상태 라이브러리를 MVP 에 도입하지 않는다. 서버 상태는 TanStack Query, 클라이언트 상태는 `useState/useReducer` 만 사용한다.
**이유**: 화면이 `/traveler`, `/guide`, 채팅 패널 수준으로 작다. 전역 상태는 대부분 "서버 상태를 전역으로 캐싱" 이라는 중복이며, TanStack Query 가 이미 커버한다.
**트레이드오프**: 페이지 간 상태 공유가 많아지면 prop drilling 이 귀찮아질 수 있다. 실제 그 수준이 되면 Zustand 도입을 별도 ADR 로 결정한다.
