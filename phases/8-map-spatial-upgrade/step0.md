# Step 0: backend-spatial-migration

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-002(Redis GEO), 스키마 설계 원칙
- `/docs/ARCHITECTURE.md` — 백엔드 계층 구조
- `/backend/src/main/resources/db/migration/V3__request.sql` — help_requests 스키마 현황
- `/backend/src/main/resources/db/migration/V11__guide_profile.sql` — 최신 마이그레이션 파일
- `/backend/src/main/java/com/localnow/request/domain/HelpRequest.java` — JPA 엔티티
- `/backend/src/main/java/com/localnow/request/repository/HelpRequestRepository.java` — 레포지토리 현황

## 배경

`help_requests` 테이블은 `lat DOUBLE` / `lng DOUBLE` 컬럼을 가지고 있으나 공간 인덱스가 없다.
가이드 온듀티 시 주변 OPEN 요청을 조회하거나 관리 쿼리에서 위치 기반 필터링이 필요할 때
현재 구조는 풀 테이블 스캔을 유발한다.

Redis GEO(ADR-002)는 **가이드 실시간 위치** 검색을 담당하며 이 step에서 변경하지 않는다.
이 step은 **help_requests 위치** 쿼리에 MySQL SPATIAL INDEX를 추가하는 것이 목적이다.

## 작업

### 1. Flyway 마이그레이션 생성

파일: `backend/src/main/resources/db/migration/V12__help_request_spatial.sql`

아래 두 DDL을 순서대로 포함하라:

```sql
-- 1. POINT STORED GENERATED 컬럼 추가
--    MySQL POINT(x, y) = POINT(longitude, latitude)
--    SRID 4326 = WGS84 지리 좌표계
ALTER TABLE help_requests
  ADD COLUMN location POINT NOT NULL
    GENERATED ALWAYS AS (ST_SRID(POINT(lng, lat), 4326)) STORED;

-- 2. R-tree SPATIAL INDEX 생성 (MBR 기반 O(log N) 검색 활성화)
CREATE SPATIAL INDEX idx_help_request_location ON help_requests (location);
```

**주의사항**:
- `GENERATED ALWAYS AS (...) STORED`를 사용하라. `VIRTUAL`은 SPATIAL INDEX를 지원하지 않는다.
- 이 컬럼은 `lat`/`lng` 변경 시 MySQL이 자동 갱신한다. JPA가 직접 쓸 필요 없다.
- `ddl-auto: validate`에서 엔티티에 매핑되지 않은 DB 컬럼은 검증 실패하지 않는다 (Hibernate가 역방향 검사는 하지 않음).

### 2. GeoUtils 헬퍼 클래스 생성

파일: `backend/src/main/java/com/localnow/common/GeoUtils.java`

```java
package com.localnow.common;

public final class GeoUtils {

    private static final double KM_PER_DEGREE_LAT = 111.32;

    private GeoUtils() {}

    /** 중심점(lat, lng)에서 radiusKm 반경의 MBR(Minimum Bounding Rectangle)을 반환한다. */
    public static Mbr boundingBox(double lat, double lng, double radiusKm) {
        double latDelta = radiusKm / KM_PER_DEGREE_LAT;
        double lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.cos(Math.toRadians(lat)));
        return new Mbr(lat - latDelta, lng - lngDelta, lat + latDelta, lng + lngDelta);
    }

    public record Mbr(double latMin, double lngMin, double latMax, double lngMax) {}
}
```

### 3. HelpRequestRepository에 공간 쿼리 추가

파일: `backend/src/main/java/com/localnow/request/repository/HelpRequestRepository.java`

아래 메서드를 추가하라. Native Query를 사용하되 **반드시 명시적 컬럼 목록**을 사용하라 (`SELECT h.*` 금지 — `location` POINT 바이너리 컬럼이 포함되면 Hibernate 매핑 오류 발생).

```java
/**
 * SPATIAL INDEX(MBR pre-filter) + ST_Distance_Sphere(exact filter) 조합으로
 * 반경 내 OPEN 요청을 O(log N)으로 조회한다.
 *
 * @param lat      중심 위도
 * @param lng      중심 경도
 * @param latMin   MBR 남쪽 위도
 * @param lngMin   MBR 서쪽 경도
 * @param latMax   MBR 북쪽 위도
 * @param lngMax   MBR 동쪽 경도
 * @param radiusM  정밀 필터 반경 (미터)
 */
@Query(value = """
    SELECT h.id, h.traveler_id, h.request_type, h.lat, h.lng, h.description,
           h.start_at, h.duration_min, h.budget_krw, h.status, h.version,
           h.created_at, h.updated_at
    FROM help_requests h
    WHERE h.status = 'OPEN'
      AND MBRWithin(
            h.location,
            ST_MakeEnvelope(
              ST_GeomFromText(CONCAT('POINT(', :lngMin, ' ', :latMin, ')'), 4326),
              ST_GeomFromText(CONCAT('POINT(', :lngMax, ' ', :latMax, ')'), 4326)
            )
          )
      AND ST_Distance_Sphere(
            h.location,
            ST_GeomFromText(CONCAT('POINT(', :lng, ' ', :lat, ')'), 4326)
          ) <= :radiusM
    ORDER BY h.id DESC
    """, nativeQuery = true)
List<HelpRequest> findNearbyOpen(
    @Param("lat") double lat,
    @Param("lng") double lng,
    @Param("latMin") double latMin,
    @Param("lngMin") double lngMin,
    @Param("latMax") double latMax,
    @Param("lngMax") double lngMax,
    @Param("radiusM") double radiusM);
```

**쿼리 설계 의도**:
- `MBRWithin(h.location, ST_MakeEnvelope(...))` — SPATIAL INDEX(R-tree)를 사용한 MBR pre-filter. 반경 범위 밖 레코드를 인덱스 레벨에서 제거한다.
- `ST_Distance_Sphere(...)` — pre-filter 통과 후 정확한 구면 거리(미터)로 재필터링한다.
- 명시적 컬럼 SELECT — `location` POINT 바이너리 컬럼을 결과에서 제외해 Hibernate 매핑 오류를 방지한다.

### 4. Testcontainers 통합 테스트 작성

파일: `backend/src/test/java/com/localnow/request/repository/HelpRequestSpatialRepositoryTest.java`

- `@Testcontainers`, `@SpringBootTest`, MySQL 8.0 컨테이너 사용
- 픽스처: 중심점(37.5665, 126.978) 기준 3km 이내 OPEN 요청 2건, 10km 외부 OPEN 요청 1건, MATCHED 상태 요청 1건
- 검증:
  - `findNearbyOpen(37.5665, 126.978, ..., 3000)` 결과가 2건
  - 10km 외부 요청과 MATCHED 요청은 결과에 포함되지 않음
- `GeoUtils.boundingBox`를 사용해 MBR 파라미터 계산

## Acceptance Criteria

```bash
cd backend && ./gradlew check
# 컴파일 에러 없음
# HelpRequestSpatialRepositoryTest 포함 전체 테스트 통과
# Flyway 마이그레이션 오류 없음 (Testcontainers MySQL에서 V12 적용 확인)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - V12 마이그레이션 파일명이 `V12__help_request_spatial.sql`인가?
   - `SELECT h.*` 대신 명시적 컬럼 목록을 사용하는가?
   - `VIRTUAL` 대신 `STORED` GENERATED 컬럼인가?
   - GeoUtils가 `com.localnow.common` 패키지에 있는가?
3. 결과에 따라 `phases/8-map-spatial-upgrade/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "V12 Flyway(POINT STORED + SPATIAL INDEX), GeoUtils.boundingBox, HelpRequestRepository.findNearbyOpen, Testcontainers 통합 테스트 추가"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- HelpRequest 엔티티에 `location` 필드를 추가하지 마라. GENERATED STORED 컬럼은 JPA가 쓰지 않으며, Hibernate validate 모드에서 엔티티 미매핑 DB 컬럼은 오류가 아니다.
- `SELECT h.*` native query를 사용하지 마라. POINT 바이너리가 결과 셋에 포함되어 Hibernate 타입 매핑 오류를 일으킨다.
- VIRTUAL GENERATED 컬럼을 사용하지 마라. MySQL InnoDB의 SPATIAL INDEX는 STORED 컬럼에만 생성 가능하다.
- Redis GEO(RedisGeoService)를 변경하지 마라. 이 step의 범위는 help_requests MySQL 공간 인덱스 추가뿐이다.
- 기존 테스트를 깨뜨리지 마라.
