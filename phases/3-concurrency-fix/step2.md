# Step 2: review-rating-atomic

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/backend/src/main/java/com/localnow/review/service/ReviewService.java`
- `/backend/src/main/java/com/localnow/user/repository/UserRepository.java`
- `/backend/src/main/java/com/localnow/user/domain/User.java`

이전 step(step1)에서 `GlobalExceptionHandler`에 `OptimisticLockException` 핸들러와 `OPTIMISTIC_LOCK_CONFLICT` 에러 코드를 추가했다.

## 문제

### `ReviewService.updateGuideRating` — lost update 가능

`createReview` 내부의 `updateGuideRating`은 다음 패턴으로 동작한다:

```java
// 현재 구현 (문제)
userRepository.findById(guideId).ifPresent(guide -> {
    int oldCount = guide.getRatingCount();
    int newCount = oldCount + 1;
    BigDecimal newAvg = guide.getAvgRating()
        .multiply(BigDecimal.valueOf(oldCount))
        .add(BigDecimal.valueOf(newRating))
        .divide(BigDecimal.valueOf(newCount), 2, RoundingMode.HALF_UP);
    guide.setRatingCount(newCount);
    guide.setAvgRating(newAvg);
    userRepository.save(guide);
});
```

이는 **read-modify-write** 패턴이다. 동일 가이드에 대해 두 리뷰가 거의 동시에 저장되면:
- 스레드 A: `findById` → count=5, avg=4.0
- 스레드 B: `findById` → count=5, avg=4.0  (A가 아직 커밋 전)
- 스레드 A: 계산 → count=6, avg=4.17 → save
- 스레드 B: 계산 → count=6, avg=3.83 → save  (**A의 갱신 유실**)

결과: rating_count=6이어야 하는데 6으로 보이지만, A의 리뷰는 최종 평균에 반영되지 않는다.

`User` 엔티티에는 `@Version`이 없으므로 낙관적 락도 작동하지 않는다.

## 작업

### 1. `UserRepository`에 원자적 평점 갱신 메서드 추가

DB에서 계산까지 단일 UPDATE로 처리해 lost update를 원천 차단한다:

```java
// UserRepository에 추가할 메서드 시그니처
@Modifying
@Transactional
@Query("""
    UPDATE User u
    SET u.avgRating = ROUND(
            (u.avgRating * u.ratingCount + :newRating) / (u.ratingCount + 1),
            2),
        u.ratingCount = u.ratingCount + 1
    WHERE u.id = :guideId
    """)
int incrementRating(@Param("guideId") Long guideId, @Param("newRating") int newRating);
```

이 쿼리는 DB 레벨에서 원자적으로 실행되므로 동시 업데이트가 직렬화된다.

**주의 — ROUND 정밀도**: MySQL의 `ROUND(x, 2)`는 반올림을 DB에서 처리한다. Java의 `RoundingMode.HALF_UP`과 동작이 동일하다(MySQL 기본). 테스트에서 소수점 2자리까지만 검증하라.

### 2. `ReviewService.updateGuideRating` 수정

기존 read-modify-write 로직을 `incrementRating` 호출 1줄로 교체한다:

```java
private void updateGuideRating(Long guideId, int newRating) {
    if (guideId == null) return;
    int updated = userRepository.incrementRating(guideId, newRating);
    if (updated == 0) {
        log.warn("incrementRating: guideId={} not found", guideId);
    }
}
```

이 메서드는 이미 `createReview`의 `@Transactional` 안에서 호출되므로, `UserRepository.incrementRating`의 `@Transactional`은 부모 트랜잭션에 참여(`REQUIRED`)한다.

### 3. 테스트

#### A. `ReviewServiceTest.java` (단위 테스트, Mockito)

기존 스타일을 맞춰 아래 케이스를 작성하라:

- `정상_리뷰_생성_가이드_평점_갱신호출됨`: `createReview` 성공 시 `userRepository.incrementRating(guideId, rating)`이 1회 호출된다
- `예외_COMPLETED_아닌_요청_리뷰불가`: 상태가 COMPLETED가 아니면 409
- `예외_여행자_아닌_사용자_리뷰불가`: `reviewerId != request.getTravelerId()`이면 403

#### B. `UserRepositoryIT.java` (통합 테스트, Testcontainers MySQL)

기존 `HelpRequestRepositoryIT`의 Testcontainers 설정 패턴을 참고해 새로 생성하라 (`backend/src/test/java/com/localnow/user/repository/UserRepositoryIT.java`):

```java
@Test
@DisplayName("동시성: 같은 가이드에 10개 리뷰 동시 평점 업데이트 → rating_count 10, avg 정확")
void incrementRating_동시_10개_정확히_반영() throws InterruptedException {
    // 준비: guide User 저장 (avgRating=0.0, ratingCount=0)
    // 실행: 10개 스레드가 동시에 incrementRating(guideId, 5) 호출
    // 검증:
    //   - ratingCount == 10
    //   - avgRating == 5.00 (모두 5점이므로)
    // 이 테스트는 read-modify-write 패턴에서는 ratingCount < 10이 되어 실패한다.
}
```

## Acceptance Criteria

```bash
cd backend && ./gradlew test --tests "com.localnow.review.service.ReviewServiceTest" --no-daemon
cd backend && ./gradlew test --tests "com.localnow.user.repository.UserRepositoryIT" --no-daemon
```

두 명령 모두 BUILD SUCCESSFUL.

전체 테스트도 확인:
```bash
cd backend && ./gradlew test --no-daemon
```

## 검증 절차

1. AC 커맨드를 실행한다.
2. 체크리스트:
   - `UserRepository`에 `@Modifying @Query` 메서드가 있는가?
   - `ReviewService.updateGuideRating`에 `findById → 계산 → save` 패턴이 남아 있지 않은가?
   - `UserRepositoryIT` 동시성 테스트에서 `ratingCount == 10`이 통과하는가?
3. 결과에 따라 `phases/3-concurrency-fix/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "ReviewService 평점 갱신을 JPQL atomic UPDATE로 교체, UserRepositoryIT 동시성 테스트 통과"`
   - 3회 실패 → `"status": "error"`, `"error_message": "구체적 에러"`

## 금지사항

- `User` 엔티티에 `@Version`을 추가하지 마라. OAuth 로그인(`UserOAuth2AccountService`), 프로필 조회 등 여러 경로에서 User를 조회·저장하는데, `@Version`을 추가하면 기존 경로에서 `OptimisticLockException`이 발생할 수 있다. 이 step은 `avg_rating` / `rating_count` 필드만 원자적으로 갱신하는 것이 목적이다.
- `ReviewService.createReview` 전체 트랜잭션 경계는 건드리지 마라. `updateGuideRating`의 내부 구현만 교체한다.
- `review` 테이블의 UNIQUE(request_id) 제약이나 중복 리뷰 체크 로직은 수정하지 마라.
