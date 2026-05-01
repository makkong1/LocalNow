# Step 1: backend-guide-baseloc

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 구현을 파악하라:

- `/docs/ADR.md` — ADR-002(Redis GEO 역할 분리), ADR-003(이벤트 기반)
- `/docs/ARCHITECTURE.md` — 백엔드 계층 구조
- `/backend/src/main/java/com/localnow/user/controller/GuideController.java`
- `/backend/src/main/resources/db/migration/V11__guide_profile.sql` — users 테이블 현황
- `/backend/src/main/resources/db/migration/V12__help_request_spatial.sql` — 최신 마이그레이션
- `/backend/src/main/java/com/localnow/user/domain/` — User 엔티티 확인
- `/backend/src/main/java/com/localnow/user/repository/` — UserRepository 확인

이전 step 0에서 완료된 변경사항:
- `GET /requests/open`에 `lat`, `lng`, `radiusKm`, `requestType`, `sortBy` 파라미터 추가

## 배경

가이드는 "주변 도움 요청" 목록을 볼 때 기준 위치가 필요하다. 현재 GPS만 사용할 수 있어, 가이드가 집이나 특정 거점에서 미리 주변 요청을 확인하고 싶어도 실시간 GPS 위치 기반으로만 검색된다. 이 step에서는 가이드가 MySQL에 "활동 거점(base location)"을 저장하고 수정할 수 있게 한다.

`users` 테이블에 `base_lat`, `base_lng` 컬럼을 추가한다. 이 값은 Redis GEO의 실시간 위치(ADR-002)와 역할이 다르다: Redis GEO = 현재 온듀티 위치(TTL, 실시간), MySQL base_lat/lng = 가이드가 저장한 거점(영속, 수동 설정).

## 작업

### 1. Flyway 마이그레이션

파일: `backend/src/main/resources/db/migration/V13__guide_base_location.sql`

```sql
ALTER TABLE users
  ADD COLUMN base_lat DOUBLE NULL,
  ADD COLUMN base_lng DOUBLE NULL;
```

NULL 허용 — 거점을 아직 설정하지 않은 가이드는 NULL.

### 2. User 엔티티 업데이트

파일: `backend/src/main/java/com/localnow/user/domain/User.java` (또는 해당 위치)

`baseLat`, `baseLng` 필드를 추가하라 (Double, nullable).

### 3. GuideProfileService 생성

파일: `backend/src/main/java/com/localnow/user/service/GuideProfileService.java`

```java
@Service
@Transactional
@RequiredArgsConstructor
public class GuideProfileService {

    private final UserRepository userRepository;

    public void saveBaseLocation(Long guideId, double lat, double lng) { ... }

    @Transactional(readOnly = true)
    public Optional<BaseLocationResponse> getBaseLocation(Long guideId) { ... }
}
```

DTO `BaseLocationResponse` record (lat, lng):
- 패키지: `com.localnow.user.dto`

### 4. GuideController — 거점 엔드포인트 추가

파일: `backend/src/main/java/com/localnow/user/controller/GuideController.java`

아래 두 엔드포인트를 추가하라:

```
PUT  /guides/me/base-location   → 거점 저장
GET  /guides/me/base-location   → 거점 조회
```

**PUT** 요청 바디 DTO (`BaseLocationRequest` record):
```java
record BaseLocationRequest(
    @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
    @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng
) {}
```

**GET** 응답:
- 거점이 설정된 경우: `ApiResponse<BaseLocationResponse>` 200
- 거점이 없는 경우: `ApiResponse<Void>` 204

두 엔드포인트 모두 `@PreAuthorize("hasRole('GUIDE')")` 적용.

### 5. 단위 테스트

파일: `backend/src/test/java/com/localnow/user/service/GuideProfileServiceTest.java`

- `saveBaseLocation` 호출 시 userRepository.save가 올바른 lat/lng로 호출되는지 검증 (Mock)
- `getBaseLocation` — 거점 있는 경우 Optional 반환, 없는 경우 Optional.empty() 반환 검증

## Acceptance Criteria

```bash
cd backend && ./gradlew check
# 컴파일 에러 없음
# 전체 테스트 통과 (GuideProfileServiceTest 포함)

# 수동 검증 (서버 실행 후, GUIDE 역할 JWT로)
# curl -X PUT http://localhost:8080/guides/me/base-location \
#   -H "Authorization: Bearer <JWT>" \
#   -H "Content-Type: application/json" \
#   -d '{"lat":37.5665,"lng":126.978}'
# curl http://localhost:8080/guides/me/base-location \
#   -H "Authorization: Bearer <JWT>"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `GuideController`가 `GuideProfileService`를 통해서만 DB에 접근하는가 (Repository 직접 호출 금지)?
   - `@PreAuthorize("hasRole('GUIDE')")` 가 두 엔드포인트 모두에 있는가?
   - `base_lat`, `base_lng`가 NULL 허용이어서 미설정 가이드의 기존 레코드에 영향이 없는가?
   - Redis GEO(`RedisGeoService`)를 변경하지 않았는가?
3. 결과에 따라 `phases/9-request-enhancements/index.json`의 step 1을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "V13 Flyway(users.base_lat/base_lng), GuideProfileService, PUT/GET /guides/me/base-location 엔드포인트 추가"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- `GuideController`에서 `UserRepository`를 직접 주입하지 마라. 반드시 `GuideProfileService`를 통해라.
- Redis GEO(RedisGeoService)를 변경하지 마라. 거점 위치와 실시간 온듀티 위치는 별개다.
- `base_lat`, `base_lng`를 `NOT NULL`로 만들지 마라. 기존 가이드 레코드에 기본값 없이 마이그레이션 실패한다.
- 기존 테스트를 깨뜨리지 마라.
