# Backend Domain: Notification

## 역할
`notification` 도메인은 RabbitMQ 이벤트를 소비해 STOMP 토픽으로 실시간 알림을 전달한다. 자체 REST API는 없고, 매칭과 채팅 도메인의 후속 이벤트를 웹 클라이언트가 받을 수 있는 형태로 변환한다.

## 주요 코드
- Listener: `backend/src/main/java/com/localnow/notification/listener/MatchNotificationListener.java`
- Listener: `backend/src/main/java/com/localnow/notification/listener/ChatNotificationListener.java`
- Config: `backend/src/main/java/com/localnow/config/RabbitMQConfig.java`
- Config: `backend/src/main/java/com/localnow/config/WebSocketConfig.java`

## 입력 이벤트
| Queue | Routing Key | 발행 도메인 | 설명 |
| --- | --- | --- | --- |
| `match.notification` | `match.offer.created` | `request` | 주변 가이드에게 새 요청을 알린다. |
| `match.notification` | `match.offer.accepted` | `match` | 여행자에게 가이드 수락을 알린다. |
| `match.notification` | `match.confirmed` | `match` | 확정된 가이드에게 매칭 확정을 알린다. |
| `chat.notification` | `chat.message.sent` | `chat` | 상대 사용자에게 새 채팅 메시지를 알린다. |

## 출력 STOMP 토픽
| Topic | 대상 | Payload Type |
| --- | --- | --- |
| `/topic/guides/{guideId}` | GUIDE | `NEW_REQUEST`, `MATCH_CONFIRMED` |
| `/topic/requests/{requestId}` | TRAVELER | `OFFER_ACCEPTED` |
| `/topic/users/{userId}` | 모든 사용자 | `CHAT_MESSAGE` |

## 도메인 규칙
- 알림 payload는 `type` 필드로 이벤트 종류를 구분한다.
- 클라이언트는 모르는 `type`을 무시해야 한다.
- topic 경로에 사용자 또는 요청 식별자를 포함해 구독 대상을 분리한다.
- 채팅 방 메시지 본문 전체 대신 preview를 전달해 알림 payload를 작게 유지한다.

## 외부 의존성
- RabbitMQ topic exchange: `localnow.topic`.
- Queue binding: `match.*`, `chat.*`.
- `SimpMessagingTemplate`: STOMP topic으로 push.
- `WebSocketConfig`: `/ws`, `/topic`, `/app` prefix 설정.

## 테스트 포인트
- 각 routing key가 기대 topic과 payload type으로 변환된다.
- 알림 listener가 payload 필드 누락에 대해 실패 방식을 명확히 한다.
- 매칭과 채팅 통합 플로우에서 커밋 이후 알림이 발행된다.
- REST API가 없는 도메인이므로 listener 단위 테스트 또는 통합 테스트로 검증한다.
