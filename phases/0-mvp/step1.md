# Step 1: backend-infra

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/API_CONVENTIONS.md`
- `/backend/build.gradle`
- `/backend/src/main/resources/application.yml`

이전 step(project-setup)에서 만들어진 Gradle 뼈대와 application.yml을 읽고 의존성 및 설정을 파악한 뒤 작업하라.

## 작업

이 step은 모든 도메인 step이 공통으로 의존하는 인프라 레이어를 만든다.
비즈니스 로직은 없다 — 설정, 공통 타입, 외부 시스템 어댑터만 다룬다.

### 1. `common/` 패키지 (`com.localnow.common`)

#### `ApiResponse<T>`
모든 HTTP 응답을 감싸는 제네릭 클래스. `API_CONVENTIONS.md`의 응답 포맷과 1:1 대응:
```
{ success, data, error: { code, message, fields }, meta: { requestId } }
```
정적 팩토리 메서드: `ApiResponse.ok(T data)`, `ApiResponse.fail(ErrorCode, String message)`.

#### `ErrorCode` (enum)
`API_CONVENTIONS.md`에 정의된 모든 코드 포함:
`AUTH_UNAUTHENTICATED(401)`, `AUTH_FORBIDDEN(403)`, `VALIDATION_FAILED(422)`,
`REQUEST_NOT_FOUND(404)`, `REQUEST_NOT_OPEN(409)`, `MATCH_ALREADY_CONFIRMED(409)`,
`PAYMENT_INVALID_STATE(409)`, `RATE_LIMITED(429)`, `INTERNAL_ERROR(500)`.
각 enum 값은 HTTP 상태코드와 기본 메시지를 갖는다.

#### `GlobalExceptionHandler` (`@RestControllerAdvice`)
- `MethodArgumentNotValidException` → `VALIDATION_FAILED` (422), `error.fields` 배열에 필드별 메시지
- `ResponseStatusException` → 상태코드 그대로, 메시지 포함
- `Exception` (catch-all) → `INTERNAL_ERROR` (500), 스택트레이스는 로그에만
- 모든 응답은 `ApiResponse.fail(...)` 형식으로 감싼다
- MDC에서 `requestId`를 읽어 `meta.requestId`에 주입한다

#### `RequestIdFilter` (`OncePerRequestFilter`)
요청마다 UUID를 생성해 MDC `requestId` 키에 저장. 응답 헤더 `X-Request-Id`에도 추가.

### 2. `config/` 패키지 (`com.localnow.config`)

#### `SecurityConfig`
- `SecurityFilterChain`: `/auth/**`, `/actuator/health`, `/actuator/info`, `/swagger-ui/**`, `/v3/api-docs/**`, `/ws/**` 는 permitAll. 나머지는 authenticated.
- `JwtAuthenticationFilter` (`OncePerRequestFilter`)를 `UsernamePasswordAuthenticationFilter` 앞에 등록.
- CSRF 비활성화 (stateless JWT).
- 세션 stateless (`SessionCreationPolicy.STATELESS`).

#### `JwtProvider`
- `io.jsonwebtoken` 0.12.x 사용.
- `generateToken(userId: Long, role: String): String` — payload: `sub`(userId), `role`, `exp`.
- `validateToken(token: String): Claims` — 만료/위변조 시 예외.
- `application.yml`의 `jwt.secret`, `jwt.expiry-seconds`를 `@Value`로 주입.
- **시크릿을 코드에 하드코딩하지 마라.**

#### `JwtAuthenticationFilter`
`Authorization: Bearer <token>` 헤더에서 토큰 추출 → `JwtProvider.validateToken` → `UsernamePasswordAuthenticationToken`으로 `SecurityContext`에 등록.

#### `WebSocketConfig` (`@EnableWebSocketMessageBroker`)
- `/ws` 엔드포인트, SockJS 폴백 허용.
- Simple broker prefix: `/topic`.
- Application destination prefix: `/app`.
- `ChannelInterceptor`는 Step 5(chat)에서 추가 — 여기서는 빈 stub만.

#### `RedisConfig`
`RedisTemplate<String, String>` 빈 등록. `StringRedisSerializer` 사용.

#### `RabbitMQConfig`
- `TopicExchange` 빈: `localnow.topic` (durable).
- `Queue` 빈: `match.notification`, `chat.notification` (durable).
- `Binding` 빈: `match.*` → `match.notification`, `chat.*` → `chat.notification`.

### 3. `infra/` 패키지 (`com.localnow.infra`)

#### `infra/redis/RedisGeoService`
- `addGuide(guideId: Long, lat: double, lng: double)`: Redis GEOADD.
- `removeGuide(guideId: Long)`: Redis GEODEL.
- `searchNearby(lat: double, lng: double, radiusKm: double): List<Long>`: Redis GEOSEARCH, 결과는 guideId 목록.
- 내부 key: `"geo:guides"`. TTL은 설정하지 않는다(가이드가 off-duty 시 명시적으로 제거).

#### `infra/rabbit/RabbitPublisher`
`RabbitTemplate`을 주입받아 `publish(routingKey: String, payload: Object)` 메서드 하나만 제공.
payload는 JSON 직렬화 (Jackson `ObjectMapper`).

#### `infra/pg/PaymentGateway` (interface)
```java
AuthResult authorize(long amountKrw, String idempotencyKey);
CaptureResult capture(String authorizationId);
RefundResult refund(String captureId, long amountKrw);
```
결과 record: `AuthResult(String authorizationId, boolean success)`,
`CaptureResult(String captureId, boolean success)`,
`RefundResult(boolean success)`.

#### `infra/pg/MockPaymentGateway` (`@Primary @Component`)
- 항상 성공 반환. `authorizationId`/`captureId`는 UUID.
- 실패 시나리오 제어용 플래그 `setFailNext(boolean)` 추가 (테스트에서만 사용).

#### `infra/translator/Translator` (interface)
```java
String translate(String text, String sourceLang, String targetLang);
```

#### `infra/translator/PassThroughTranslator` (`@Primary @Component`)
입력 `text`를 그대로 반환.

### 4. 테스트

`common/ApiResponseTest` — `ok()`, `fail()` 팩토리 메서드 단위 테스트.
`infra/pg/MockPaymentGatewayTest` — authorize/capture/refund 정상 + `setFailNext(true)` 케이스.

## Acceptance Criteria

```bash
cd backend && ./gradlew check
```

컴파일 에러, 테스트 실패 모두 0.

## 검증 절차

1. `./gradlew check` 실행.
2. 체크리스트:
   - `JwtProvider`에 시크릿 하드코딩이 없는가?
   - `GlobalExceptionHandler`가 `ApiResponse` 봉투로만 응답하는가?
   - `MockPaymentGateway`에 `@Primary`가 붙어 있는가?
   - `infra/` 클래스들이 `service/` 를 import하지 않는가? (단방향 의존)
3. `phases/0-mvp/index.json` step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "common(ApiResponse/ErrorCode/GlobalExceptionHandler), config(Security/JWT/WebSocket/Redis/RabbitMQ), infra(RedisGeoService/RabbitPublisher/MockPaymentGateway/PassThroughTranslator) 구현 완료. ./gradlew check 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- `JwtProvider`에 JWT 시크릿을 하드코딩하지 마라. 이유: 커밋 시 시크릿 노출.
- `infra/` 클래스가 도메인 서비스(`user/service`, `request/service` 등)를 직접 import하지 마라. 이유: 의존 방향이 역전된다.
- `WebSocketConfig`에서 `ChannelInterceptor` 구현을 완성하지 마라. 이유: Step 5(chat)에서 채팅 권한 로직과 함께 추가한다.
- 기존 테스트를 깨뜨리지 마라.
