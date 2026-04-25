# Backend Domain: Chat

## 역할
`chat` 도메인은 매칭된 여행자와 가이드의 채팅방, 메시지 저장, 메시지 히스토리 조회, STOMP 실시간 송수신을 담당한다. 채팅 메시지 저장 후에는 상대방 알림을 위해 RabbitMQ 이벤트를 발행한다.

## 주요 코드
- REST Controller: `backend/src/main/java/com/localnow/chat/controller/ChatController.java`
- STOMP Controller: `backend/src/main/java/com/localnow/chat/controller/StompChatController.java`
- Service: `backend/src/main/java/com/localnow/chat/service/ChatService.java`
- Domain: `backend/src/main/java/com/localnow/chat/domain/ChatRoom.java`
- Domain: `backend/src/main/java/com/localnow/chat/domain/ChatMessage.java`
- Repository: `ChatRoomRepository`, `ChatMessageRepository`
- DTO: `ChatRoomResponse`, `ChatMessageRequest`, `ChatMessageResponse`

## HTTP API
| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `GET` | `/requests/{requestId}/room` | Participant | 요청에 연결된 채팅방을 조회한다. |
| `GET` | `/rooms/{roomId}/messages` | Participant | 채팅 메시지 히스토리를 cursor 기반으로 조회한다. |

## STOMP
| Type | Destination | 설명 |
| --- | --- | --- |
| CONNECT | `/ws` | SockJS 지원 WebSocket 엔드포인트. `Authorization: Bearer <token>` 헤더가 필요하다. |
| SEND | `/app/rooms/{roomId}/messages` | 메시지를 전송한다. payload는 `content`, `clientMessageId`를 포함한다. |
| SUBSCRIBE | `/topic/rooms/{roomId}` | 방 참여자만 구독할 수 있다. |

## 도메인 규칙
- 채팅방은 매칭 확정 시 `match` 도메인에서 생성된다.
- 방 참여자는 해당 요청의 여행자와 확정된 가이드다.
- 메시지 저장은 `clientMessageId`로 멱등성을 보장한다.
- 메시지 조회와 STOMP 구독은 방 참여자만 가능하다.
- STOMP 구독 권한은 `ChatChannelInterceptor`가 검증한다.
- 메시지 저장 후 `/topic/rooms/{roomId}`로 실시간 브로드캐스트한다.

## 이벤트
| Routing Key | 발행 시점 | 소비 |
| --- | --- | --- |
| `chat.message.sent` | 메시지 저장 커밋 이후 | `notification` 도메인이 상대 사용자 토픽으로 푸시 |

## 외부 의존성
- `config/WebSocketConfig`: STOMP endpoint, broker prefix, application prefix 설정.
- `config/ChatChannelInterceptor`: CONNECT 인증과 방 구독 권한 검증.
- `infra/rabbit/RabbitPublisher`: 채팅 알림 이벤트 발행.

## 테스트 포인트
- 방 참여자가 아닌 사용자는 메시지 조회와 구독이 거절된다.
- 같은 `clientMessageId`의 재전송은 메시지를 중복 저장하지 않는다.
- STOMP 메시지 전송 후 저장, 브로드캐스트, 알림 이벤트 발행이 연결된다.
- cursor 기반 메시지 조회 순서가 안정적이다.
