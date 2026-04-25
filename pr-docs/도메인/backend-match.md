# Backend Domain: Match

## 역할
`match` 도메인은 가이드의 요청 수락, 여행자의 가이드 확정, 매칭 오퍼 상태 전이를 담당한다. 확정 시 요청 상태를 `MATCHED`로 바꾸고 채팅방을 생성하며, 관련 알림 이벤트를 RabbitMQ로 발행한다.

## 주요 코드
- Controller: `backend/src/main/java/com/localnow/match/controller/MatchController.java`
- Service: `backend/src/main/java/com/localnow/match/service/MatchService.java`
- Domain: `backend/src/main/java/com/localnow/match/domain/MatchOffer.java`
- Domain: `backend/src/main/java/com/localnow/match/domain/MatchOfferStatus.java`
- Repository: `backend/src/main/java/com/localnow/match/repository/MatchOfferRepository.java`
- DTO: `AcceptRequest`, `ConfirmRequest`, `MatchOfferResponse`

## API
| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `POST` | `/requests/{requestId}/accept` | GUIDE | 가이드가 요청을 수락하고 오퍼를 만든다. |
| `POST` | `/requests/{requestId}/confirm` | TRAVELER | 여행자가 특정 가이드를 확정한다. |
| `GET` | `/requests/{requestId}/offers` | Authenticated | 해당 요청의 오퍼 목록을 조회한다. |

## 상태
| Status | 의미 |
| --- | --- |
| `PENDING` | 가이드가 수락했지만 여행자가 아직 확정하지 않은 상태. |
| `CONFIRMED` | 여행자가 선택한 오퍼. |
| `REJECTED` | 다른 오퍼가 확정되면서 거절된 상태. |

## 도메인 규칙
- 수락은 요청 상태가 `OPEN`일 때만 가능하다.
- 같은 `(requestId, guideId)`로 재수락하면 기존 오퍼를 반환하는 멱등 동작을 한다.
- 확정은 요청 소유자인 TRAVELER만 수행할 수 있다.
- 확정은 요청 상태가 `OPEN`이고 대상 가이드의 오퍼가 존재할 때만 가능하다.
- 확정 성공 시 선택된 오퍼는 `CONFIRMED`, 나머지 오퍼는 `REJECTED`가 된다.
- 확정 성공 시 `chat` 도메인을 통해 채팅방을 생성한다.
- 확정 경쟁은 Redis 분산락과 DB 비관적 락으로 보호한다.

## 이벤트
| Routing Key | 발행 시점 | 소비 |
| --- | --- | --- |
| `match.offer.accepted` | 가이드가 요청을 수락한 뒤 커밋 이후 | `notification` 도메인이 여행자 요청 토픽으로 푸시 |
| `match.confirmed` | 여행자가 가이드를 확정한 뒤 커밋 이후 | `notification` 도메인이 확정 가이드 토픽으로 푸시 |

## 외부 의존성
- `request` 도메인: 요청 소유자, 상태, 락 조회.
- `chat` 도메인: 확정 후 채팅방 생성.
- `infra/rabbit/RabbitPublisher`: 매칭 이벤트 발행.
- Redis 분산락: `lock:request:{requestId}` 키로 확정 경쟁을 제한한다.

## 테스트 포인트
- 수락 API는 GUIDE만 호출할 수 있다.
- 동일 가이드의 중복 수락은 오퍼를 중복 생성하지 않는다.
- 확정 경쟁에서 하나의 오퍼만 `CONFIRMED`가 된다.
- 확정 후 채팅방 생성과 이벤트 발행이 커밋 이후에 이뤄진다.
