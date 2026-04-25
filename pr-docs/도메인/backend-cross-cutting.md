# Backend Cross-Cutting Concerns

## 역할
이 문서는 특정 도메인에만 속하지 않는 백엔드 공통 관심사를 정리한다. 도메인 문서는 각자 필요한 공통 컴포넌트만 참조하고, 상세 규칙은 여기에서 관리한다.

## 공통 응답과 에러
- `backend/src/main/java/com/localnow/common/ApiResponse.java`는 모든 public API 응답 봉투다.
- `backend/src/main/java/com/localnow/common/ErrorCode.java`는 클라이언트가 분기할 수 있는 에러 코드를 정의한다.
- `backend/src/main/java/com/localnow/common/GlobalExceptionHandler.java`는 예외를 공통 응답 포맷으로 변환한다.
- `backend/src/main/java/com/localnow/common/RequestIdFilter.java`는 요청 추적용 `requestId`를 생성하거나 전달한다.

## 보안
- `backend/src/main/java/com/localnow/config/SecurityConfig.java`가 HTTP 보안 정책을 정의한다.
- `backend/src/main/java/com/localnow/config/JwtProvider.java`가 JWT 생성과 검증을 담당한다.
- `backend/src/main/java/com/localnow/config/JwtAuthenticationFilter.java`가 HTTP 요청의 Bearer token을 인증 객체로 변환한다.
- 백엔드 JWT payload에는 `sub`, `role`, `exp`만 넣고 PII는 넣지 않는다.
- `/auth/**`, `/actuator/health`, WebSocket 연결에 필요한 경로 외에는 기본적으로 인증이 필요하다.

## WebSocket
- `backend/src/main/java/com/localnow/config/WebSocketConfig.java`가 STOMP endpoint와 broker prefix를 설정한다.
- WebSocket endpoint는 `/ws`이며 SockJS fallback을 지원한다.
- broker prefix는 `/topic`, application prefix는 `/app`이다.
- `backend/src/main/java/com/localnow/config/ChatChannelInterceptor.java`가 CONNECT 인증과 `/topic/rooms/{roomId}` 구독 권한을 검증한다.

## RabbitMQ
- `backend/src/main/java/com/localnow/config/RabbitMQConfig.java`가 exchange, queue, binding을 선언한다.
- topic exchange는 `localnow.topic`이다.
- `match.notification` queue는 `match.*` routing key를 소비한다.
- `chat.notification` queue는 `chat.*` routing key를 소비한다.
- `backend/src/main/java/com/localnow/infra/rabbit/RabbitPublisher.java`가 도메인 서비스의 RabbitMQ 발행을 감싼다.

## Redis
- `backend/src/main/java/com/localnow/config/RedisConfig.java`가 RedisTemplate 설정을 담당한다.
- `backend/src/main/java/com/localnow/infra/redis/RedisGeoService.java`는 가이드 위치 등록, 삭제, 반경 검색을 제공한다.
- 매칭 확정 락은 요청 단위 키(`lock:request:{requestId}`)를 사용한다.
- Redis 락은 짧은 TTL과 소유자 확인 기반 해제를 전제로 한다.

## 외부 시스템 추상화
- `backend/src/main/java/com/localnow/infra/pg/PaymentGateway.java`는 결제 게이트웨이 인터페이스다.
- `backend/src/main/java/com/localnow/infra/pg/MockPaymentGateway.java`는 MVP용 Fake 결제 구현이다.
- `backend/src/main/java/com/localnow/infra/translator/Translator.java`와 `PassThroughTranslator`는 번역 인터페이스와 통과 구현이다. 현재 핵심 플로우에서는 예약 성격의 인프라로 취급한다.

## 설계 원칙
- Controller는 요청 검증과 응답 매핑만 담당한다.
- 비즈니스 로직은 service 계층에 둔다.
- DB, Redis, RabbitMQ, 외부 API 접근은 repository 또는 infra 계층을 통해 수행한다.
- 외부 노출 DTO와 JPA 엔티티를 섞지 않는다.
- 돈과 매칭 확정 상태 변경은 트랜잭션 경계 안에서 수행한다.

## 검증 포인트
- 모든 public API가 `ApiResponse<T>` 형태를 유지한다.
- 인증 실패, 권한 부족, 검증 실패가 표준 에러 코드로 변환된다.
- WebSocket CONNECT와 room SUBSCRIBE 권한 검증이 분리되어 동작한다.
- RabbitMQ 이벤트는 트랜잭션 커밋 이후 발행된다.
- Redis GEO와 분산락 키는 도메인 문서와 코드가 같은 명명 규칙을 사용한다.
