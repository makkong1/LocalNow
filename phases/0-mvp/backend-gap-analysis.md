# Backend Gap Analysis

> 분석 기준: `backend/` 실제 구현 기준  
> 목적: 0-mvp 완료 후 발견된 백엔드 부족 로직을 정리하고, 모바일 앱 phase 진입 전에 보강할 우선순위를 명확히 한다.

## 요약

백엔드는 인증, 요청, 매칭, 채팅, 결제, 리뷰, 알림의 핵심 골격이 구현되어 있다. 다만 모바일 앱이 백엔드를 직접 호출하는 구조로 전환되면 BFF가 흡수하던 일부 위험이 백엔드 표면으로 드러난다. 따라서 “앱용 API”와 “웹용 API”를 분리하지 말고, 백엔드를 단일 공식 API 로 두고 웹 BFF 는 그 API 를 얇게 proxy 해야 한다. 특히 조회 API의 당사자 검증, STOMP 알림 토픽 구독 권한, 가이드용 OPEN 요청 조회 API, Native WebSocket 엔드포인트가 우선 보강 대상이다.

## 웹/모바일 API 정렬 원칙

| 구분 | 웹 | 모바일 | 유지해야 할 공통점 |
| --- | --- | --- | --- |
| HTTP 호출 | Browser → `web/src/app/api/**` → Backend | App → Backend | Backend endpoint, DTO, error code |
| 토큰 저장 | HttpOnly cookie | `expo-secure-store` | 백엔드 호출 시 `Authorization: Bearer <jwt>` |
| WebSocket transport | SockJS `/ws` | Native WebSocket `/ws-native` | STOMP destination, payload |

- `docs/API_CONVENTIONS.md` 가 유일한 백엔드 공식 계약이다.
- 웹 Route Handler 는 쿠키 인증을 Bearer 호출로 변환하는 adapter 이며, 백엔드에 없는 웹 전용 비즈니스 API 를 만들지 않는다.
- 모바일은 같은 백엔드 endpoint 를 직접 호출한다.
- 웹에서 필요한 데이터가 백엔드에 없다면 BFF에서 우회하지 말고 백엔드 공식 endpoint 를 추가한다.

## 심각도 기준

- `P0`: 개인정보, 위치, 결제, 매칭 정보 노출 가능성이 있는 보안 이슈.
- `P1`: 모바일 앱 또는 데모 핵심 플로우를 막는 API/인프라 공백.
- `P2`: 도메인 상태 머신, 운영 안정성, 확장성 보강.
- `P3`: 테스트, 설정, 개발 편의성 보강.

---

## P0. 권한 및 정보 노출

### 1. STOMP 알림 토픽 구독 권한 검증 부족

**근거**
- `backend/src/main/java/com/localnow/config/ChatChannelInterceptor.java`
- `backend/src/main/java/com/localnow/notification/listener/MatchNotificationListener.java`
- `backend/src/main/java/com/localnow/notification/listener/ChatNotificationListener.java`

`ChatChannelInterceptor`는 `/topic/rooms/{roomId}` 구독에 대해서는 방 참여자 검증을 수행한다. 하지만 알림 토픽인 `/topic/guides/{guideId}`, `/topic/requests/{requestId}`, `/topic/users/{userId}`에 대해서는 destination별 권한 검증이 없다.

**영향**
- 인증된 사용자가 타인의 guideId, userId, requestId를 추측해 알림 토픽을 구독할 수 있다.
- 새 요청, 오퍼 수락, 매칭 확정, 채팅 알림 preview 같은 실시간 정보가 노출될 수 있다.

**권장 보강**
- `ChatChannelInterceptor`에서 `SUBSCRIBE` destination별 정책을 추가한다.
- `/topic/users/{userId}`와 `/topic/guides/{guideId}`는 JWT `sub`와 path id가 같을 때만 허용한다.
- `/topic/requests/{requestId}`는 요청 여행자 또는 해당 요청에 관련된 가이드만 허용한다.
- 권한 실패 시 STOMP 구독을 거절하고 감사 로그를 남긴다.

### 2. 결제 의도 조회의 당사자 검증 부족

**근거**
- `backend/src/main/java/com/localnow/payment/controller/PaymentController.java`
- `backend/src/main/java/com/localnow/payment/service/PaymentService.java`

`GET /payments/{requestId}`는 인증 사용자 ID를 서비스에 전달하지 않고, `PaymentService.getByRequestId(requestId)`는 payer/payee 확인 없이 결제 의도를 반환한다.

**영향**
- requestId를 아는 인증 사용자가 결제 금액, 플랫폼 수수료, 가이드 정산액을 조회할 수 있다.
- 모바일 앱에서 백엔드를 직접 호출하면 BFF 계층 없이 이 API가 그대로 외부 계약이 된다.

**권장 보강**
- `PaymentController`가 `Authentication`의 principal userId를 `PaymentService`로 전달한다.
- `PaymentService.getByRequestId(requestId, userId)`에서 `payerId` 또는 `payeeId`가 현재 사용자와 같을 때만 반환한다.
- 무관한 사용자는 `AUTH_FORBIDDEN`으로 거절한다.

### 3. 요청 단건 및 오퍼 목록 조회의 당사자 검증 부족

**근거**
- `backend/src/main/java/com/localnow/request/service/RequestService.java`
- `backend/src/main/java/com/localnow/match/controller/MatchController.java`
- `backend/src/main/java/com/localnow/match/service/MatchService.java`

`GET /requests/{id}`는 요청 ID만으로 조회한다. `GET /requests/{requestId}/offers` 역시 인증만 있으면 오퍼 목록을 반환한다.

**영향**
- 타인의 요청 설명, 위치 좌표, 예산, 상태, travelerId가 노출될 수 있다.
- 오퍼 목록과 가이드 정보가 요청과 무관한 사용자에게 노출될 수 있다.

**권장 보강**
- 요청 단건 조회는 요청 여행자, 해당 요청에 오퍼를 낸 가이드, 또는 정책상 허용된 공개 OPEN 요청 요약으로 분리한다.
- 오퍼 목록 조회는 요청 여행자 또는 해당 요청에 오퍼를 낸 가이드만 허용한다.
- 가이드가 볼 OPEN 요청 목록은 별도 요약 API로 분리해 필요한 필드만 노출한다.

---

## P1. 모바일 앱 및 데모 플로우 차단 요소

### 4. 가이드용 OPEN 요청 조회 API 부재

**근거**
- `backend/src/main/java/com/localnow/request/controller/RequestController.java`
- `backend/src/main/java/com/localnow/request/service/RequestService.java`
- `backend/src/main/java/com/localnow/request/repository/HelpRequestRepository.java`

현재 요청 API는 `POST /requests`, `GET /requests/me`, `GET /requests/{id}` 중심이다. 가이드가 현재 열린 요청 목록을 REST로 조회하는 API가 없다.

**영향**
- 모바일 가이드 화면에서 앱 재시작, 재연결, 백그라운드 복귀 시 OPEN 요청 목록을 복구하기 어렵다.
- STOMP 알림만으로 목록 상태를 구성하면 이벤트 유실 또는 최초 진입 시 빈 화면 문제가 생긴다.

**권장 보강**
- `GET /requests/open?cursor={id}&size=20` 추가.
- GUIDE 권한만 허용한다.
- `HelpRequestStatus.OPEN`만 cursor 기반으로 조회한다.
- 초기 버전은 위치 반경 필터 없이 OPEN 목록을 반환하고, 이후 `lat/lng/radiusKm` 필터를 확장한다.

### 5. Native WebSocket 엔드포인트 부재

**근거**
- `backend/src/main/java/com/localnow/config/WebSocketConfig.java`

현재 STOMP endpoint는 `/ws`에 SockJS만 등록되어 있다.

**영향**
- React Native는 SockJS 폴백이 필요 없고 Native WebSocket으로 연결하는 것이 자연스럽다.
- 모바일 앱 phase의 `@stomp/stompjs` Native WebSocket 연결과 백엔드 endpoint가 맞지 않는다.

**권장 보강**
- 기존 웹 호환성을 위해 `/ws` SockJS endpoint는 유지한다.
- `/ws-native` 순수 WebSocket endpoint를 추가한다.
- `SecurityConfig` 공개 경로에도 `/ws-native/**`를 포함한다.

### 6. CORS 설정 명시 없음

**근거**
- `backend/src/main/java/com/localnow/config/SecurityConfig.java`

현재 Security 설정에 명시적인 CORS 설정이 없다.

**영향**
- 네이티브 모바일 앱 자체는 브라우저 CORS 제약을 받지 않지만, Expo Web, 개발 도구, 향후 직접 호출 웹 클라이언트에서 문제가 될 수 있다.
- 모바일 전환 문서와 실제 백엔드 설정이 어긋난다.

**권장 보강**
- `CorsConfigurationSource` bean을 등록한다.
- MVP에서는 `allowedOriginPatterns("*")`, `allowCredentials(false)`로 시작한다.
- 운영 전환 시 환경변수 기반 allowlist로 제한한다.

### 7. `@PreAuthorize` 사용 대비 메서드 보안 활성화 확인 필요

**근거**
- `backend/src/main/java/com/localnow/user/controller/GuideController.java`
- `backend/src/main/java/com/localnow/config/SecurityConfig.java`

`GuideController`는 `@PreAuthorize("hasRole('GUIDE')")`에 의존한다. 하지만 설정 코드에서 `@EnableMethodSecurity` 활성화가 보이지 않는다.

**영향**
- 메서드 보안이 비활성화된 경우 TRAVELER도 `/guide/duty`를 호출해 Redis GEO에 자신을 가이드처럼 등록할 수 있다.
- 매칭 후보 품질과 권한 경계가 깨진다.

**권장 보강**
- `SecurityConfig` 또는 별도 설정 클래스에 `@EnableMethodSecurity`를 추가한다.
- `GuideController` 권한 테스트를 추가해 GUIDE만 duty 변경이 가능함을 고정한다.

---

## P2. 도메인 플로우 및 운영 안정성

### 8. `IN_PROGRESS`, `CANCELLED` 상태 전이 API 부재

**근거**
- `backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- `backend/src/main/java/com/localnow/request/service/RequestService.java`
- `backend/src/main/java/com/localnow/payment/service/PaymentService.java`

엔티티에는 `toInProgress`, `toCancelled`가 있지만 실제 서비스 플로우에서는 호출되지 않는다. 현재 주요 흐름은 `OPEN -> MATCHED -> COMPLETED`에 가깝다.

**영향**
- 진행 시작, 취소, 환불 정책이 명확하지 않다.
- 리뷰 작성 가능 시점과 결제 캡처 시점이 제품 경험과 어긋날 수 있다.

**권장 보강**
- MVP 유지 시 문서에 실제 상태 흐름을 명확히 적는다.
- 기능 확장 시 `POST /requests/{id}/start`, `POST /requests/{id}/cancel` 같은 명시 API와 결제 환불 정책을 함께 설계한다.

### 9. 매칭 확정 알림이 가이드 중심으로만 전달됨

**근거**
- `backend/src/main/java/com/localnow/notification/listener/MatchNotificationListener.java`

`match.confirmed` 이벤트는 확정 가이드 토픽으로 push된다. 여행자는 REST confirm 응답으로 결과를 알 수 있지만, 다른 기기나 재연결 상황에서 일관된 push 경로가 부족하다.

**영향**
- 모바일에서 여행자 앱이 백그라운드/다중 기기 상태일 때 상태 동기화가 약하다.

**권장 보강**
- 확정 시 `/topic/requests/{requestId}` 또는 `/topic/users/{travelerId}`에도 이벤트를 발행한다.
- 단, 앞의 STOMP 구독 권한 검증을 먼저 보강해야 한다.

### 10. RabbitMQ 발행 payload 로그의 민감 정보 노출 가능성

**근거**
- `backend/src/main/java/com/localnow/infra/rabbit/RabbitPublisher.java`

Rabbit publish 로그가 payload 전체를 남길 수 있다.

**영향**
- 채팅 preview, 요청 설명, 결제 관련 필드가 운영 로그에 남을 가능성이 있다.

**권장 보강**
- INFO 로그에서는 routingKey, eventType, 주요 id만 남긴다.
- payload 전문은 DEBUG로 낮추거나 민감 필드를 마스킹한다.

### 11. JWT secret 기본값 존재

**근거**
- `backend/src/main/resources/application.yml`

`JWT_SECRET`에 기본값 `please-change-this-secret-in-production`이 있다.

**영향**
- 운영 환경에서 환경변수 누락 시 약한 고정 secret으로 서버가 기동될 수 있다.

**권장 보강**
- local profile에서는 기본값을 허용하되, non-local profile에서는 secret 누락 또는 기본값 사용 시 기동 실패 처리한다.
- 배포 문서에 `JWT_SECRET` 필수값을 명시한다.

---

## P3. 테스트 및 개발 안정성

### 12. 컨트롤러 권한 테스트 부족

**근거**
- `backend/src/test/java/com/localnow/user/controller/UserControllerTest.java`
- `backend/src/test/java/com/localnow/**`

현재 컨트롤러 테스트는 사용자 인증 중심이다. `RequestController`, `MatchController`, `PaymentController`, `ChatController`, `GuideController`, `ReviewController`의 HTTP 권한/응답 계약 테스트가 부족하다.

**영향**
- 401/403/422 응답, 공통 `ApiResponse` 직렬화, 역할 검증 누락을 빌드에서 잡기 어렵다.

**권장 보강**
- `@WebMvcTest`로 주요 컨트롤러별 최소 계약 테스트를 추가한다.
- 특히 `GET /requests/open`, `GET /requests/{id}/offers`, `GET /payments/{requestId}`, `POST /guide/duty` 권한 매트릭스를 우선 검증한다.

### 13. Testcontainers 통합 테스트 실행 안정성

**근거**
- `backend/src/test/java/com/localnow/request/repository/HelpRequestRepositoryIT.java`
- `backend/src/test/java/com/localnow/request/infra/MatchDispatcherIT.java`
- `backend/src/test/java/com/localnow/match/service/MatchServiceConcurrencyIT.java`
- `backend/src/test/java/com/localnow/chat/ChatFlowIT.java`
- `backend/build.gradle`

통합 테스트가 Docker 환경에 강하게 의존하고, 로컬 Docker 소켓 경로 설정이 특정 환경에 맞춰져 있다.

**영향**
- 매칭 동시성, RabbitMQ, WebSocket, Redis GEO 같은 핵심 포인트가 환경에 따라 skip되거나 실패할 수 있다.

**권장 보강**
- CI 환경 기준 Docker 설정을 문서화한다.
- `DOCKER_HOST`, `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`, Ryuk 설정을 개발자 환경별로 분리한다.
- 통합 테스트가 skip된 경우 빌드 산출물에 명확히 표시한다.

### 14. 결제 멱등성 DB 제약 확인 필요

**근거**
- `backend/src/main/java/com/localnow/payment/service/PaymentService.java`
- `backend/src/main/resources/db/migration/V6__payment.sql`

서비스는 idempotency key 기반으로 기존 결제 의도를 반환한다. 다만 동시 요청까지 막으려면 DB unique 제약이 필요하다.

**영향**
- 같은 요청에 대해 거의 동시에 결제 의도 생성 요청이 들어오면 중복 row 가능성이 있다.

**권장 보강**
- `request_id`, `idempotency_key`에 unique 제약이 있는지 마이그레이션을 확인한다.
- 없다면 새 Flyway migration으로 unique 제약을 추가한다.

---

## 우선순위 제안

### 1순위: 모바일 진입 전 필수

1. STOMP 알림 토픽 구독 권한 검증.
2. `GET /requests/open` GUIDE 전용 API.
3. 결제 조회와 오퍼 조회 당사자 검증.
4. `/ws-native` Native WebSocket endpoint.
5. `@EnableMethodSecurity` 및 `POST /guide/duty` 권한 테스트.

### 2순위: MVP 안정화

1. CORS 설정 명시.
2. 컨트롤러 권한 테스트 추가.
3. 결제 intent unique 제약 확인 및 보강.
4. Rabbit payload 로그 마스킹.

### 3순위: 제품 플로우 확장

1. `IN_PROGRESS`, `CANCELLED` API 설계.
2. 여행자 대상 매칭 확정 push 보강.
3. JWT refresh token 도입.
4. 가이드 승인/온보딩 정책 도입.

## 이미 잘 구현된 부분

- `match` 확정은 Redis 분산락과 DB 락을 함께 사용한다.
- `chat` 메시지는 `clientMessageId`로 멱등 저장을 시도한다.
- `chat` REST 조회는 방 참여자 검증을 수행한다.
- `payment` 생성, 캡처, 환불은 상태 머신을 통해 전이한다.
- `review`는 완료 요청, 여행자 소유자, 중복 리뷰를 검증한다.
- RabbitMQ 이벤트와 STOMP push 구조는 MVP 수준의 실시간 흐름을 보여주기에 충분한 골격을 갖췄다.
