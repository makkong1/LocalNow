# Step 3: docs-adr-update

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 내용을 파악하라:

- `/docs/ADR.md` — 기존 ADR 목록과 형식
- `/docs/ARCHITECTURE.md` — 현재 아키텍처 기술 내용
- `/CLAUDE.md` — 기술 스택 섹션

이전 step들에서 완료된 변경사항 summary:
- step 0: V12 Flyway(help_requests에 POINT STORED + SPATIAL INDEX), GeoUtils, HelpRequestRepository.findNearbyOpen 추가
- step 1: RequestService.findNearbyOpenRequests 추가, MatchDispatcher 반경 @Value 외부화
- step 2: react-native-maps → @rnmapbox/maps 교체, dark-v11 스타일, UserLocation 내장

## 배경

이 step은 구현 변경사항을 문서에 반영한다. 코드 변경 없이 문서만 수정한다.

## 작업

### 1. ADR.md에 ADR-016 추가

파일: `docs/ADR.md` 마지막에 추가

```markdown
### ADR-016: 모바일 지도 라이브러리를 @rnmapbox/maps로 교체한다
**결정**: 모바일 앱의 지도 라이브러리를 `react-native-maps` + OpenStreetMap UrlTile 오버레이에서 `@rnmapbox/maps` v10+ (Mapbox dark-v11 벡터 스타일)로 교체한다. Mapbox 무료 공개 토큰(`pk.ey...`)은 `.env.local`에서 `EXPO_PUBLIC_MAPBOX_TOKEN`으로 로드한다. Mapbox 다운로드 토큰(`sk.ey...`)은 `~/.netrc` / `~/.gradle/gradle.properties`에서 관리하며 git에 커밋하지 않는다.
**이유**: 기존 구현은 네이티브 지도 엔진(iOS: Apple Maps, Android: Google Maps) 위에 OSM 래스터 타일을 덮어씌우는 방식으로, (1) 두 레이어의 스타일 불일치로 시각적 어색함 발생, (2) OSM 타일이 항상 라이트 테마여서 앱 다크 테마와 충돌, (3) `showsUserLocation` 미설정으로 사용자 현재 위치 표시 없음 세 가지 문제가 있었다. `@rnmapbox/maps`는 벡터 타일 기반으로 dark-v11 스타일을 기본 제공하며, `MapboxGL.UserLocation`으로 위치 표시를 내장 지원한다. React Native 0.76 New Architecture(Fabric)도 공식 지원한다.
**트레이드오프**: Mapbox 계정 생성과 토큰 설정이 필요하다(무료 티어 월 50,000 map loads). 네이티브 빌드 전 다운로드 토큰을 로컬에 설정해야 하므로 신규 개발자 온보딩 단계가 추가된다. ADR-008(웹 클라이언트의 Google Maps/Mapbox 금지)은 웹 전용 결정이며 모바일에는 적용되지 않는다.
```

### 2. ADR.md에 ADR-017 추가

ADR-016 바로 아래에 추가:

```markdown
### ADR-017: help_requests에 MySQL SPATIAL INDEX를 추가한다 (ADR-002 보완)
**결정**: `help_requests` 테이블에 `location POINT NOT NULL GENERATED ALWAYS AS (ST_SRID(POINT(lng, lat), 4326)) STORED` 컬럼과 `SPATIAL INDEX idx_help_request_location`을 추가한다(V12 Flyway). `HelpRequestRepository.findNearbyOpen`은 MBR pre-filter(`MBRWithin`) + 정밀 필터(`ST_Distance_Sphere`)를 조합해 O(log N) 공간 쿼리를 제공한다.
**이유**: ADR-002에서 가이드 실시간 위치 검색은 Redis GEO로 처리하기로 결정했으나, help_requests 테이블의 `lat`/`lng` 컬럼에는 인덱스가 없었다. 가이드가 온듀티 전환 시 주변 OPEN 요청 조회, 관리 화면의 지역별 요청 집계 등의 쿼리가 풀 테이블 스캔으로 동작했다. MySQL 8.0 InnoDB의 R-tree SPATIAL INDEX로 이를 O(log N)으로 개선한다. 두 인덱스의 역할은 명확히 분리된다: Redis GEO = 가이드 실시간 위치(TTL 있는 단기 상태), MySQL SPATIAL = help_requests 위치(영속 데이터, 쿼리 최적화).
**트레이드오프**: `STORED` GENERATED 컬럼은 INSERT/UPDATE 시 추가 연산이 발생하지만, help_requests 생성은 매칭 이벤트 단위(빈도 낮음)라 부담이 없다. MySQL SPATIAL INDEX는 SRID를 엄격하게 다루므로 쿼리와 컬럼의 SRID가 일치해야 한다(둘 다 4326).
```

### 3. ARCHITECTURE.md 업데이트

파일: `docs/ARCHITECTURE.md`

아래 내용을 찾아 교체하라:

**변경 전**:
```
│   └── LocationMap.tsx     # react-native-maps 래퍼
```

**변경 후**:
```
│   └── LocationMap.tsx     # @rnmapbox/maps 래퍼 (dark-v11 스타일, UserLocation 내장)
```

### 4. CLAUDE.md 기술 스택 업데이트

파일: `CLAUDE.md`

Mobile 기술 스택 섹션에서:

**변경 전**:
```
- `react-native-maps` + OpenStreetMap 타일 (지도. API 키 불필요)
```

**변경 후**:
```
- `@rnmapbox/maps` v10+ + Mapbox dark-v11 벡터 스타일 (지도. 무료 공개 토큰 `.env.local`에서 로드)
```

## Acceptance Criteria

```bash
# ADR-016, ADR-017이 docs/ADR.md에 추가됐는지 확인
grep -n "ADR-016\|ADR-017" docs/ADR.md

# ARCHITECTURE.md가 @rnmapbox/maps로 업데이트됐는지 확인
grep -n "rnmapbox" docs/ARCHITECTURE.md

# CLAUDE.md가 업데이트됐는지 확인
grep -n "rnmapbox" CLAUDE.md
```

위 세 grep 명령이 모두 결과를 출력해야 한다.

## 검증 절차

1. 위 AC grep 명령을 실행한다.
2. 체크리스트:
   - ADR-016이 모바일 지도 라이브러리 교체 이유와 트레이드오프를 포함하는가?
   - ADR-017이 ADR-002와의 역할 분리를 명확히 설명하는가?
   - ARCHITECTURE.md의 LocationMap 설명이 `@rnmapbox/maps`로 변경됐는가?
   - CLAUDE.md 기술 스택이 `@rnmapbox/maps`로 변경됐는가?
3. 결과에 따라 `phases/8-map-spatial-upgrade/index.json`의 step 3을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "ADR-016(모바일 지도 교체), ADR-017(MySQL SPATIAL INDEX) 추가. ARCHITECTURE.md, CLAUDE.md 기술 스택 업데이트"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- 코드를 수정하지 마라. 이 step은 문서 전용이다.
- ADR 번호를 임의로 바꾸지 마라. ADR-016과 ADR-017 그대로 사용하라.
- 기존 ADR 내용을 삭제하거나 재작성하지 마라. 기존 ADR 아래에 추가만 하라.
- ADR.md 형식(제목 h3, 결정/이유/트레이드오프 구조)을 기존 ADR과 일관되게 유지하라.
