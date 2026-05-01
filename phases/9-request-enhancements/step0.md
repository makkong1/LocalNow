# Step 0: backend-filter-sort

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 구현을 파악하라:

- `/docs/ADR.md` — ADR-002(Redis GEO), ADR-003(이벤트 기반), ADR-017(MySQL SPATIAL INDEX)
- `/docs/ARCHITECTURE.md` — 백엔드 계층 구조
- `/backend/src/main/java/com/localnow/request/controller/RequestController.java`
- `/backend/src/main/java/com/localnow/request/service/RequestService.java`
- `/backend/src/main/java/com/localnow/request/repository/HelpRequestRepository.java`
- `/backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- `/backend/src/main/java/com/localnow/common/GeoUtils.java`

## 배경

현재 `GET /requests/open`은 OPEN 상태 요청을 `id DESC` 순으로 커서 페이지네이션하며, 위치 필터·카테고리 필터·가격 정렬이 없다. 이 step에서 가이드가 주변 도움 요청을 카테고리와 가격으로 필터·정렬할 수 있도록 백엔드를 확장한다.

ADR-017에서 추가된 `findNearbyOpen`(SPATIAL INDEX 기반)이 이미 존재하며 이 step에서 활용한다.

## 작업

### 1. RequestController — `GET /requests/open` 파라미터 추가

파일: `backend/src/main/java/com/localnow/request/controller/RequestController.java`

기존 `cursor`, `size` 파라미터에 아래를 추가하라:

```java
@RequestParam(required = false) RequestType requestType,   // null = 전체
@RequestParam(required = false) String sortBy,             // "budgetAsc" | "budgetDesc" | null = 기본(id DESC)
@RequestParam(required = false) Double lat,
@RequestParam(required = false) Double lng,
@RequestParam(required = false, defaultValue = "5.0") double radiusKm
```

이 파라미터들을 `requestService.getOpenRequests(...)` 에 그대로 전달하라. 컨트롤러는 검증과 위임만 한다.

### 2. RequestService — getOpenRequests 오버로드

파일: `backend/src/main/java/com/localnow/request/service/RequestService.java`

기존 시그니처를 아래로 교체하라:

```java
public HelpRequestPageResponse getOpenRequests(
    @Nullable Long cursor, int size,
    @Nullable RequestType requestType,
    @Nullable String sortBy,
    @Nullable Double lat, @Nullable Double lng, double radiusKm)
```

구현 로직:

1. **위치 파라미터(lat, lng) 존재 시**: `GeoUtils.boundingBox`로 MBR 계산 → `findNearbyOpen` 호출 → 결과에서 `requestType` 필터 적용(Java stream filter) → `sortBy` 정렬 적용 → 전체 결과 반환(커서 없음, 최대 50건 cap)
2. **위치 파라미터 없이 requestType 또는 sortBy만 있는 경우**: 아래 새 레포지토리 메서드 사용
3. **파라미터 모두 없는 경우**: 기존 커서 페이지네이션 유지

`sortBy` 처리 규칙:
- `"budgetAsc"` → `budgetKrw` 오름차순
- `"budgetDesc"` → `budgetKrw` 내림차순
- 그 외 / null → `id` 내림차순 (기존 동작)

케이스 2를 위한 정렬은 Java stream으로 처리해도 되고 레포지토리 쿼리로 처리해도 된다. 다만 케이스 2는 항상 전체 OPEN 목록에서 필터하므로 결과 수를 50건으로 cap 하라.

### 3. HelpRequestRepository — 필터 쿼리 추가 (선택)

위 케이스 2를 위해 필요하다면 아래 메서드를 추가하라. `requestType`이 null이면 전체, 있으면 해당 타입만:

```java
List<HelpRequest> findByStatusAndRequestTypeOrderByBudgetKrwAsc(HelpRequestStatus status, RequestType requestType, Pageable pageable);
List<HelpRequest> findByStatusAndRequestTypeOrderByBudgetKrwDesc(HelpRequestStatus status, RequestType requestType, Pageable pageable);
List<HelpRequest> findByStatusOrderByBudgetKrwAsc(HelpRequestStatus status, Pageable pageable);
List<HelpRequest> findByStatusOrderByBudgetKrwDesc(HelpRequestStatus status, Pageable pageable);
```

Spring Data JPA 메서드명으로 자동 생성되므로 별도 @Query 없이 사용 가능하다.

### 4. 단위 테스트

파일: `backend/src/test/java/com/localnow/request/service/RequestServiceTest.java` (기존 파일에 추가)

- `requestType=GUIDE` 필터 적용 시 다른 타입이 제외되는지 검증
- `sortBy=budgetAsc` 적용 시 결과가 오름차순으로 정렬되는지 검증
- `lat/lng` 전달 시 `findNearbyOpen`이 호출되는지 검증 (Mock)
- 기존 테스트가 모두 통과하는지 확인

## Acceptance Criteria

```bash
cd backend && ./gradlew check
# 컴파일 에러 없음
# 전체 테스트 통과

# 수동 검증 (서버 실행 후)
# curl "http://localhost:8080/requests/open?requestType=GUIDE&sortBy=budgetAsc"
# curl "http://localhost:8080/requests/open?lat=37.5665&lng=126.978&radiusKm=3.0"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 컨트롤러가 Repository를 직접 호출하지 않는가?
   - 위치 파라미터 없는 기존 호출이 동일하게 동작하는가 (하위 호환)?
   - `findNearbyOpen`의 SELECT가 기존과 동일한 명시적 컬럼 목록을 사용하는가 (SELECT * 금지)?
3. 결과에 따라 `phases/9-request-enhancements/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "GET /requests/open에 requestType 필터, sortBy, lat/lng/radiusKm 파라미터 추가. 위치 있으면 SPATIAL 검색, 없으면 커서 페이지네이션 유지"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- 기존 `cursor`/`size` 기반 동작을 제거하지 마라. 파라미터 없을 때 기존 동작을 유지해야 한다.
- `SELECT h.*` native query를 사용하지 마라. POINT 바이너리 컬럼 Hibernate 매핑 오류 발생.
- 결과 목록을 50건 이상 반환하지 마라. 위치/필터/정렬 조합 시 무제한 반환은 성능 위험.
- 기존 테스트를 깨뜨리지 마라.
