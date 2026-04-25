# Backend Domain: Request

## 역할
`request` 도메인은 여행자의 도움 요청 생성과 조회를 담당한다. 요청 생성 후 트랜잭션 커밋이 완료되면 매칭 후보 탐색 이벤트를 발행해 주변 가이드에게 알림이 이어지도록 한다.

## 주요 코드
- Controller: `backend/src/main/java/com/localnow/request/controller/RequestController.java`
- Service: `backend/src/main/java/com/localnow/request/service/RequestService.java`
- Service: `backend/src/main/java/com/localnow/request/service/MatchDispatcher.java`
- Domain: `backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- Domain: `HelpRequestStatus`, `RequestType`
- Repository: `backend/src/main/java/com/localnow/request/repository/HelpRequestRepository.java`
- Event: `backend/src/main/java/com/localnow/request/event/MatchDispatchEvent.java`
- DTO: `CreateRequestRequest`, `HelpRequestResponse`, `HelpRequestPageResponse`

## API
| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `POST` | `/requests` | TRAVELER | 도움 요청을 생성한다. |
| `GET` | `/requests/me` | Authenticated | 내 요청 목록을 cursor 기반으로 조회한다. |
| `GET` | `/requests/{id}` | Authenticated | 요청 단건을 조회한다. |

## 상태
| Status | 의미 |
| --- | --- |
| `OPEN` | 생성 직후 상태. 가이드가 수락할 수 있다. |
| `MATCHED` | 여행자가 가이드 1명을 확정한 상태. |
| `IN_PROGRESS` | 진행 중 상태로 예약되어 있으나 현재 주요 플로우에서는 직접 전이되지 않는다. |
| `COMPLETED` | 결제 캡처 후 완료된 상태. 리뷰 작성이 가능하다. |
| `CANCELLED` | 취소된 상태. |

## 도메인 규칙
- 요청 생성은 TRAVELER만 가능하다.
- 요청 생성 직후 상태는 `OPEN`이다.
- 생성 트랜잭션 커밋 이후 `MatchDispatchEvent`를 처리한다.
- `MatchDispatcher`는 Redis GEO로 근처 가이드를 조회하고 RabbitMQ에 `match.offer.created` 이벤트를 발행한다.
- 확정과 완료 상태 전이는 각각 `match`, `payment` 도메인에서 수행한다.
- `HelpRequestRepository.findByIdWithLock`은 매칭 확정 시 요청 단위 동시성 보호에 사용된다.

## 외부 의존성
- `infra/redis/RedisGeoService`: 주변 가이드 검색.
- `infra/rabbit/RabbitPublisher`: 후보 가이드 알림 이벤트 발행.
- `common/ApiResponse`, `common/ErrorCode`: API 응답과 에러 표준화.

## 테스트 포인트
- TRAVELER만 요청을 생성할 수 있다.
- 요청 생성 후 커밋 이후에만 매칭 디스패치가 실행된다.
- 목록 조회는 cursor 기반 페이징을 따른다.
- 비관적 락 조회는 매칭 확정 경쟁 상황에서 요청 상태를 보호한다.
