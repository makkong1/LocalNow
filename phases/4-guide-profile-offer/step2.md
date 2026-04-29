# Step 2: backend-guide-public-profile

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/API_CONVENTIONS.md`
- `/backend/src/main/java/com/localnow/user/domain/User.java`
- `/backend/src/main/java/com/localnow/user/domain/Certification.java` (Step 0에서 생성)
- `/backend/src/main/java/com/localnow/user/dto/UserProfileResponse.java`
- `/backend/src/main/java/com/localnow/user/dto/CertificationResponse.java` (Step 0에서 생성)
- `/backend/src/main/java/com/localnow/user/controller/UserController.java`
- `/backend/src/main/java/com/localnow/user/service/UserService.java`
- `/backend/src/main/java/com/localnow/user/repository/UserRepository.java`
- `/backend/src/main/java/com/localnow/user/repository/CertificationRepository.java` (Step 0에서 생성)
- `/backend/src/main/java/com/localnow/review/dto/ReviewResponse.java`
- `/backend/src/main/java/com/localnow/review/service/ReviewService.java`
- `/backend/src/main/java/com/localnow/match/repository/MatchOfferRepository.java`
- `/backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- `/backend/src/main/java/com/localnow/config/SecurityConfig.java`

이전 step들에서 만들어진 코드를 꼼꼼히 읽고 설계 의도를 파악한 뒤 작업하라.

## 작업

누구든지(인증 없이도) 특정 사용자의 공개 프로필을 조회할 수 있는 API를 구현한다. 가이드는 자격증, 완료 서비스 수, 최근 후기까지 포함한다.

### 1. PublicProfileResponse DTO 신설

`/backend/src/main/java/com/localnow/user/dto/PublicProfileResponse.java`:

```java
public record PublicProfileResponse(
    Long id,
    String name,
    String profileImageUrl,
    Integer birthYear,            // null 가능
    String bio,                   // null 가능
    String role,                  // "TRAVELER" | "GUIDE"
    List<String> languages,
    BigDecimal avgRating,
    Integer ratingCount,
    // 가이드 전용 (TRAVELER면 null)
    Integer completedCount,
    List<CertificationResponse> certifications,
    List<ReviewResponse> recentReviews   // 최근 5개
) {}
```

### 2. 완료 서비스 수 쿼리

`MatchOfferRepository`에 메서드 추가:

```java
@Query("""
    SELECT COUNT(mo) FROM MatchOffer mo
    JOIN HelpRequest hr ON hr.id = mo.requestId
    WHERE mo.guideId = :guideId
      AND mo.status = 'CONFIRMED'
      AND hr.status = 'COMPLETED'
    """)
long countCompletedByGuideId(@Param("guideId") Long guideId);
```

### 3. UserService에 공개 프로필 조회 메서드 추가

```java
public PublicProfileResponse getPublicProfile(Long userId)
```

구현 로직:
1. `UserRepository.findById(userId)` — 없으면 404 (`ErrorCode.USER_NOT_FOUND`)
2. `CertificationRepository.findByUserId(userId)` — 가이드이면 자격증 목록, TRAVELER면 빈 리스트
3. `MatchOfferRepository.countCompletedByGuideId(userId)` — 가이드이면 호출, TRAVELER면 0
4. `ReviewService.getRecentReviews(userId, 5)` — 최근 후기 5개 (ReviewService에 메서드 추가 필요)
5. `PublicProfileResponse`로 조립하여 반환

`ReviewService`에 추가:
```java
public List<ReviewResponse> getRecentReviews(Long revieweeId, int limit)
```

### 4. UserController에 엔드포인트 추가

```
GET /users/{userId}/profile
인증: 불필요 (누구나 조회 가능)
응답: ApiResponse<PublicProfileResponse>
```

`SecurityConfig`에서 `GET /users/*/profile`을 `permitAll()`에 추가.

## Acceptance Criteria

```bash
cd backend && ./gradlew check
```

추가 수동 확인:
```bash
cd backend && ./gradlew bootRun
# 인증 없이 프로필 조회
curl -s http://localhost:8080/users/1/profile | jq .
# → id, name, profileImageUrl, role, languages, avgRating, ratingCount 포함
# → 가이드이면 certifications[], completedCount, recentReviews[] 포함
# → TRAVELER이면 certifications=[], completedCount=0
```

## 검증 절차

1. `./gradlew check` 실행 후 결과 확인
2. 아키텍처 체크:
   - `UserController`가 `ReviewService`, `CertificationRepository`를 직접 주입하지 않고 `UserService`를 통해서만 데이터를 조합하는가?
   - 존재하지 않는 userId 요청 시 404가 반환되는가?
3. 결과에 따라 `phases/4-guide-profile-offer/index.json` 해당 step 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "GET /users/{userId}/profile 공개 API 완료, PublicProfileResponse(자격증+완료수+최근후기 포함)"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러"`

## 금지사항

- `UserController`가 `CertificationRepository`나 `MatchOfferRepository`를 직접 주입받지 마라. 이유: 컨트롤러는 서비스 계층을 통해서만 데이터에 접근해야 한다.
- `PublicProfileResponse`에 `password`, `email`을 포함하지 마라. 이유: 공개 API이므로 민감 정보 노출 금지.
- `recentReviews`를 전부 가져오지 마라. 최근 5개만 반환하라. 이유: 응답 크기 제어.
