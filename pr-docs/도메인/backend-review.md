# Backend Domain: Review

## 역할
`review` 도메인은 완료된 도움 요청에 대한 리뷰 작성과 가이드별 리뷰 목록 조회를 담당한다. 리뷰 작성 시 피평가 가이드의 평균 평점과 리뷰 수를 함께 갱신한다.

## 주요 코드
- Controller: `backend/src/main/java/com/localnow/review/controller/ReviewController.java`
- Service: `backend/src/main/java/com/localnow/review/service/ReviewService.java`
- Domain: `backend/src/main/java/com/localnow/review/domain/Review.java`
- Repository: `backend/src/main/java/com/localnow/review/repository/ReviewRepository.java`
- DTO: `CreateReviewRequest`, `ReviewResponse`, `ReviewPageResponse`

## API
| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `POST` | `/requests/{requestId}/review` | TRAVELER | 완료된 요청에 리뷰를 작성한다. |
| `GET` | `/users/{userId}/reviews` | Public | 특정 사용자의 리뷰 목록을 cursor 기반으로 조회한다. |

## 도메인 규칙
- 리뷰는 `COMPLETED` 상태의 요청에만 작성할 수 있다.
- 리뷰어는 해당 요청의 여행자여야 한다.
- 피평가자는 확정된 매칭 오퍼의 가이드다.
- 요청 하나에는 리뷰 하나만 작성할 수 있다.
- 리뷰 작성 시 가이드의 `avgRating`, `ratingCount`를 갱신한다.
- 목록 조회는 cursor 기반 페이징을 따른다.

## 외부 의존성
- `request` 도메인: 요청 상태와 여행자 확인.
- `match` 도메인: 확정된 가이드 확인.
- `user` 도메인: 피평가자의 평점 집계 갱신.

## 테스트 포인트
- 완료되지 않은 요청에는 리뷰를 작성할 수 없다.
- 요청 소유자가 아닌 사용자의 리뷰 작성은 거절된다.
- 같은 요청에 리뷰를 중복 작성할 수 없다.
- 리뷰 작성 후 가이드 평점 집계가 정확히 갱신된다.
- 리뷰 목록은 cursor와 size 기준으로 안정적으로 페이지를 나눈다.
