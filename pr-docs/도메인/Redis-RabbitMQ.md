# Redis · RabbitMQ 사용 맵 (백엔드)

`backend/` 기준으로 **어디서** 쓰는지, **키·라우팅·큐**가 무엇인지 정리한다. MySQL JPA는 제외.

로컬 인프라: 루트 `docker-compose.yml` — Redis `6379`, RabbitMQ AMQP `5672`·관리 UI `15672`.

---

## Redis

| 구성       | 위치                                    | 설명                                                           |
| ---------- | --------------------------------------- | -------------------------------------------------------------- |
| 클라이언트 | `com.localnow.config.redis.RedisConfig` | `RedisTemplate<String, String>` (String 직렬화).               |
| 연결       | `application*.yml` / env                | `spring.data.redis.host`·`port` (compose 기본 localhost:6379). |

### 1) GEO — 주변 가이드 검색

| 항목   | 값                                                                                  |
| ------ | ----------------------------------------------------------------------------------- |
| 클래스 | `com.localnow.infra.redis.RedisGeoService`                                          |
| 키     | `geo:guides` (상수 `GEO_KEY`)                                                       |
| 쓰기   | `addGuide(guideId, lat, lng)` — Redis GEO (좌표는 **lng, lat** 저장), `removeGuide` |
| 읽기   | `searchNearby(lat, lng, radiusKm)` — `GeoOperations.radius`                         |

**호출 흐름**

- `GuideController` (`POST /guide/duty`, on-duty=true) → `RedisGeoService.addGuide` (off → `removeGuide`).
- `MatchDispatcher` (`@TransactionalEventListener(AFTER_COMMIT)` on `MatchDispatchEvent`) → 요청 위치 기준 `searchNearby(..., 5.0)` 으로 가이드 ID 목록 조회 → RabbitMQ `match.offer.created` 페이로드에 `guideIds` 포함 (아래 RabbitMQ).

### 2) 분산락 — 매칭 확정 단일화

| 항목        | 값                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 클래스      | `com.localnow.match.service.MatchService`                                                                                                           |
| 키          | `lock:request:{requestId}` (문자열 `lockKey`)                                                                                                       |
| 획득        | `redisTemplate.opsForValue().setIfAbsent(lockKey, lockValue, 5, TimeUnit.SECONDS)` — 값은 UUID, TTL 5초.                                            |
| 해제        | Lua 스크립트 `RELEASE_LOCK_SCRIPT` — `GET` 이 현재 `lockValue` 일 때만 `DEL` (오너만 해제).                                                         |
| 사용 메서드 | `confirm(...)` — 락 획득 후 `TransactionTemplate`으로 DB 작업, `finally`에서 `releaseLock`. 락 실패 시 409 + `MATCH_ALREADY_CONFIRMED` 성격의 응답. |

**다른 키 패턴**은 없다 (캐시/세션용 Redis 사용 없음, MVP 기준).

---

## RabbitMQ

| 구성           | 위치                                        | 설명                                                                                                                                                     |
| -------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 교환/큐/바인딩 | `com.localnow.config.rabbit.RabbitMQConfig` | `TopicExchange` **`localnow.topic`** (durable). 큐: **`match.notification`**, **`chat.notification`**. 바인딩: `match.*` → match 큐, `chat.*` → chat 큐. |
| 발행           | `com.localnow.infra.rabbit.RabbitPublisher` | `RabbitTemplate.convertAndSend(EXCHANGE_NAME, routingKey, JSON)` — 페이로드는 Jackson 직렬화 **문자열**.                                                 |

### 발행 지점 (Producer)

| routing key            | 발행하는 곳       | 트리거 / 페이로드 요약                                                                                                                                   |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `match.offer.created`  | `MatchDispatcher` | `HelpRequest` 생성 커밋 **이후** — `requestId`, `requestType`, `lat`, `lng`, `budgetKrw`, **`guideIds`** (Redis GEO 5km).                                |
| `match.offer.accepted` | `MatchService`    | 가이드가 요청 **첫** 수락으로 새 `MatchOffer` 저장 직후 — `TransactionSynchronization.afterCommit` (또는 비동기화 없으면 즉시) — `requestId`, `guideId`. |
| `match.confirmed`      | `MatchService`    | 여행자 확정(`doConfirm` 경로)에서 채팅방 생성 등 커밋 **이후** — `requestId`, `confirmedGuideId`.                                                        |
| `chat.message.sent`    | `ChatService`     | 채팅 메시지 최초 저장 직후(멱등 분기의 신규 저장) — `afterCommit` — `roomId`, `senderId`, `receiverId`, `content`.                                       |

같이 알아둘 점: `ChatService.sendMessage` 는 **같은 트랜잭션 안에서** 먼저 `SimpMessagingTemplate.convertAndSend("/topic/rooms/{roomId}", …)` 로 방 구독자에게 STOMP 푸시하고, **수신자 알림(프리뷰)** 는 Rabbit → 리스너 → `/topic/users/{receiverId}` 로 간다 (아래).

### 소비 (Consumer) → STOMP 푸시

| 큐                   | 리스너                      | routing key 처리       | STOMP destination (요약)                                                                              |
| -------------------- | --------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `match.notification` | `MatchNotificationListener` | `match.offer.created`  | 각 `guideId` → `/topic/guides/{guideId}` — `{ type: NEW_REQUEST, requestId, requestType, budgetKrw }` |
|                      |                             | `match.offer.accepted` | `/topic/requests/{requestId}` — `{ type: OFFER_ACCEPTED, guideId }`                                   |
|                      |                             | `match.confirmed`      | `/topic/guides/{confirmedGuideId}` — `{ type: MATCH_CONFIRMED, requestId }`                           |
| `chat.notification`  | `ChatNotificationListener`  | `chat.message.sent`    | `/topic/users/{receiverId}` — `{ type: CHAT_MESSAGE, roomId, preview(≤30자) }`                        |

알 수 없는 match routing key 는 debug 로그만, 예외는 로그 + 소비 쪽에서 삼킴에 가깝게 처리(전체 흐름은 리스너 코드 참고).

---

## 끝에서 본 데이터 플로우 (요약)

1. **도움 요청 생성** → 커밋 후 `MatchDispatcher`가 Redis GEO로 가이드 찾고 → `match.offer.created` → 가이드별 STOMP.
2. **가이드 수락** (신규 offer) → `match.offer.accepted` → 요청 토픽 STOMP.
3. **확정** → Redis `lock:request:*` + DB → `match.confirmed` → 확정 가이드 토픽 STOMP.
4. **채팅** → 방 토픽은 동기 STOMP, 상대 방 알림(프리뷰)은 `chat.message.sent` → `chat.notification` → 사용자 토픽 STOMP.

상위 설계 흐름은 `docs/ARCHITECTURE.md` 의 “이벤트 기반”, “데이터 흐름”과 같이 본다. 교차 절은 `pr-docs/도메인/backend-cross-cutting.md`·`pr-docs/도메인/backend-notification.md` 참고.
