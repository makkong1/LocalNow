# Step 1: backend-spatial-service

## 읽어야 할 파일

먼저 아래 파일들을 읽고 맥락을 파악하라:

- `/docs/ADR.md` — ADR-002(Redis GEO 역할 분리), ADR-003(이벤트 기반 아키텍처)
- `/docs/ARCHITECTURE.md` — 계층 구조, 이벤트 흐름
- `/backend/src/main/java/com/localnow/request/service/RequestService.java`
- `/backend/src/main/java/com/localnow/request/service/MatchDispatcher.java`
- `/backend/src/main/java/com/localnow/request/repository/HelpRequestRepository.java` — step 0에서 추가된 `findNearbyOpen` 포함
- `/backend/src/main/java/com/localnow/common/GeoUtils.java` — step 0에서 생성
- `/backend/src/main/resources/application.yml`

이전 step 0에서 만들어진 코드를 꼼꼼히 읽고 설계 의도를 이해한 뒤 작업하라.

## 배경

step 0에서 `HelpRequestRepository.findNearbyOpen`과 `GeoUtils.boundingBox`가 추가됐다.
이번 step에서는 두 가지를 처리한다:

1. **`RequestService`에 `findNearbyOpenRequests` 서비스 메서드 추가** — 가이드가 온듀티 전환 시 또는 주변 요청 목록 조회 시 사용할 수 있는 서비스 계층 메서드
2. **`MatchDispatcher`의 하드코딩된 반경 `5.0` km 외부화** — 운영 환경에서 설정 변경만으로 반경 조정 가능

## 작업

### 1. RequestService에 findNearbyOpenRequests 추가

파일: `backend/src/main/java/com/localnow/request/service/RequestService.java`

아래 메서드 시그니처를 추가하라:

```java
/**
 * 지정 좌표에서 radiusKm 반경 내 OPEN 상태 요청을 조회한다.
 * SPATIAL INDEX(MBR pre-filter) + ST_Distance_Sphere(exact filter) 조합으로 동작한다.
 */
public List<HelpRequest> findNearbyOpenRequests(double lat, double lng, double radiusKm) {
    GeoUtils.Mbr mbr = GeoUtils.boundingBox(lat, lng, radiusKm);
    double radiusM = radiusKm * 1000.0;
    return helpRequestRepository.findNearbyOpen(
        lat, lng,
        mbr.latMin(), mbr.lngMin(),
        mbr.latMax(), mbr.lngMax(),
        radiusM
    );
}
```

- `GeoUtils.boundingBox`로 MBR 파라미터를 계산한 뒤 `HelpRequestRepository.findNearbyOpen`에 전달한다.
- 반경은 km 단위로 받아 내부에서 미터로 변환한다 (ST_Distance_Sphere는 미터 반환).
- 이 메서드는 컨트롤러에서 직접 호출될 수도 있고, 이후 가이드 온듀티 흐름에서 활용될 수 있다. 현재는 서비스 계층에만 추가하며 컨트롤러 엔드포인트 추가는 이 step 범위 밖이다.

### 2. MatchDispatcher 반경 외부화

파일: `backend/src/main/java/com/localnow/request/service/MatchDispatcher.java`

현재 하드코딩된 `5.0`을 `@Value` 설정으로 교체하라:

```java
@Value("${localnow.match.search-radius-km:5.0}")
private double searchRadiusKm;
```

`onMatchDispatch` 메서드 내 `redisGeoService.searchNearby(event.lat(), event.lng(), 5.0)` 호출에서 `5.0`을 `searchRadiusKm`으로 교체하라.

**주의**: `@Value` 필드는 Spring이 주입하므로 `@RequiredArgsConstructor`의 생성자 주입 대상이 아니다. 필드 주입으로 선언하라.

### 3. application.yml에 설정 추가

파일: `backend/src/main/resources/application.yml`

기존 `localnow:` 섹션 아래에 추가하라:

```yaml
localnow:
  upload:
    dir: ${UPLOAD_DIR:./uploads}
  match:
    search-radius-km: ${MATCH_SEARCH_RADIUS_KM:5.0}
```

### 4. 단위 테스트 작성

**RequestServiceTest** — 신규 또는 기존 파일:

파일: `backend/src/test/java/com/localnow/request/service/RequestServiceTest.java`

`findNearbyOpenRequests` 테스트:
- `HelpRequestRepository.findNearbyOpen`을 Mock하라.
- 입력 `(lat=37.5665, lng=126.978, radiusKm=3.0)` 호출 시:
  - `GeoUtils.boundingBox`가 생성한 MBR 값이 레포지토리에 전달되는지 검증
  - 반경이 km → m 변환(`3000.0`)되어 전달되는지 검증
- Mock이 반환한 리스트가 서비스 반환값과 동일한지 검증

**MatchDispatcherTest** — `searchRadiusKm` @Value 주입 검증:
- `@Value("${localnow.match.search-radius-km:5.0}")`가 올바르게 주입되는지 확인
- 기본값(`5.0`)이 적용되는지 확인 (테스트 컨텍스트에서 해당 프로퍼티 미설정 시)

## Acceptance Criteria

```bash
cd backend && ./gradlew check
# 컴파일 에러 없음
# RequestServiceTest, MatchDispatcherTest 포함 전체 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `findNearbyOpenRequests`가 컨트롤러가 아닌 서비스 계층에 있는가?
   - `MatchDispatcher`가 하드코딩 `5.0` 없이 `@Value` 필드를 사용하는가?
   - `application.yml`에 `localnow.match.search-radius-km` 키가 추가됐는가?
   - 단위 테스트가 Mock을 사용해 외부 의존성 없이 실행되는가?
3. 결과에 따라 `phases/8-map-spatial-upgrade/index.json`의 step 1을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "RequestService.findNearbyOpenRequests 추가, MatchDispatcher 반경 @Value 외부화, application.yml localnow.match.search-radius-km 설정 추가"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- 컨트롤러에 `findNearbyOpenRequests` 엔드포인트를 추가하지 마라. 이 step은 서비스 계층 준비가 목적이며, API 노출은 별도 요구사항이다.
- Redis GEO(`RedisGeoService`)를 변경하지 마라. `MatchDispatcher`가 Redis GEO를 사용하는 방식은 그대로 유지한다(반경 파라미터만 외부화).
- `@Value` 필드를 `@RequiredArgsConstructor` 생성자에 포함하지 마라. Lombok이 final 필드만 생성자에 포함하며, `@Value` 필드는 Spring이 별도로 주입한다.
- 기존 테스트를 깨뜨리지 마라.
