# Step 2: mobile-map-migration

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 구현을 파악하라:

- `/docs/ADR.md` — ADR-011(React Native), ADR-012(직접 API 호출)
- `/docs/UI_GUIDE.md` — 다크 테마, amber/orange 포인트 컬러 규칙
- `/mobile/src/components/LocationMap.tsx` — 교체 대상 컴포넌트
- `/mobile/src/screens/TravelerScreen.tsx` — LocationMap 사용 화면
- `/mobile/src/components/OnDutyToggle.tsx` — expo-location 사용 현황
- `/mobile/app.json` — Expo 플러그인 설정
- `/mobile/package.json` — 의존성 현황
- `/mobile/.env.local.example` — 환경변수 예시

## 배경

현재 `LocationMap.tsx`는 `react-native-maps` v1.20.1에 OpenStreetMap `UrlTile`을 오버레이하는 방식을 사용한다.
이 방식은 다음 문제를 가진다:
- 네이티브 지도 엔진(iOS: Apple Maps, Android: Google Maps) 위에 OSM 래스터 타일을 덮으므로 시각적으로 어색하다.
- 앱 다크 테마와 매칭되지 않는다 (OSM 타일은 항상 라이트 테마).
- `showsUserLocation` prop이 없어 사용자 현재 위치(파란 점)가 표시되지 않는다.

`@rnmapbox/maps`로 교체하면:
- Mapbox 벡터 타일(dark-v11 스타일)로 앱 다크 테마와 일치
- `MapboxGL.UserLocation`으로 사용자 현재 위치 내장 표시
- React Native 0.76 New Architecture 공식 지원

## 전제 조건 (BLOCKED 가능)

이 step 실행 전 반드시 확인하라:

**Mapbox 공개 토큰 (런타임 필수)**:
- [mapbox.com](https://mapbox.com)에서 무료 계정 생성 후 Default Public Token (`pk.ey...`) 복사
- `/mobile/.env.local`에 추가: `EXPO_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...`
- 이 파일이 없거나 토큰이 비어있으면 지도 타일이 표시되지 않는다.

**Mapbox 다운로드 토큰 (네이티브 빌드 필수)**:
- Mapbox 대시보드 → Tokens → Create a token (Secret Token `sk.ey...`)
- iOS: `~/.netrc`에 추가:
  ```
  machine api.mapbox.com
    login mapbox
    password sk.eyJ1...
  ```
- Android: `~/.gradle/gradle.properties`에 추가:
  ```
  MAPBOX_DOWNLOADS_TOKEN=sk.eyJ1...
  ```
- 이 설정이 없으면 `npx expo run:ios/android` 시 네이티브 SDK 다운로드 실패

위 두 토큰이 설정되지 않은 경우:
```json
{ "status": "blocked", "blocked_reason": "Mapbox 계정 생성 및 토큰 설정 필요. step2.md 전제 조건 섹션 참고" }
```

## 작업

### 1. 라이브러리 교체

`mobile/` 디렉토리에서 실행:

```bash
npm uninstall react-native-maps
npx expo install @rnmapbox/maps
```

### 2. app.json 플러그인 업데이트

파일: `mobile/app.json`

`plugins` 배열에 Mapbox 플러그인을 추가하라:

```json
"plugins": [
  "expo-secure-store",
  "@react-native-community/datetimepicker",
  ["@rnmapbox/maps", {
    "RNMapboxMapsDownloadToken": ""
  }]
]
```

`RNMapboxMapsDownloadToken`을 빈 문자열로 두면 플러그인이 설치 시 다운로드 시도를 건너뛴다.
실제 네이티브 빌드는 `~/.netrc` / `~/.gradle/gradle.properties`의 토큰을 사용한다.

iOS 위치 권한 설명이 `infoPlist`에 없으면 추가하라:

```json
"infoPlist": {
  "NSAppTransportSecurity": { "NSAllowsLocalNetworking": true },
  "NSLocationWhenInUseUsageDescription": "현재 위치를 지도에 표시하고 주변 가이드를 찾기 위해 사용합니다."
}
```

### 3. LocationMap.tsx 재작성

파일: `mobile/src/components/LocationMap.tsx`

Props 인터페이스는 기존과 동일하게 유지하라 (하위 호환 — TravelerScreen 등 호출부 수정 불필요):

```typescript
interface LocationMapProps {
  lat: number;
  lng: number;
  onLocationChange?: (lat: number, lng: number) => void;
  markers?: Array<{ id: string; lat: number; lng: number; title: string }>;
}
```

구현 요구사항:
- `MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')` — 모듈 최상위에서 한 번 호출
- `MapboxGL.MapView` — `styleURL="mapbox://styles/mapbox/dark-v11"` 적용
- `MapboxGL.Camera` — `centerCoordinate={[lng, lat]}`, `zoomLevel={14}`, `animationDuration={300}`
- `MapboxGL.UserLocation` — `visible={true}`, 사용자 현재 위치 파란 점 표시
- 메인 마커 — `MapboxGL.PointAnnotation` id="selected-location", 좌표 `[lng, lat]`
  - 자식 뷰: amber(`#f59e0b`) 원형 마커 (View + borderRadius)
  - `MapboxGL.Callout` 또는 빈 `<></>`으로 callout 설정
- 추가 마커 — `markers` prop의 각 항목을 `MapboxGL.PointAnnotation`으로 렌더
  - white(`#ffffff`) 원형 마커
  - `MapboxGL.Callout title={m.title}`
- `onPress` 핸들러 — `onLocationChange` prop이 있을 때만 `MapboxGL.MapView`의 `onPress`를 등록
  - `@rnmapbox/maps`의 onPress feature 타입: `Feature<Point>`. 좌표는 `feature.geometry.coordinates: [lng, lat]`

**주의**: `MapboxGL.PointAnnotation`은 자식 View를 반드시 하나 가져야 한다. 자식 없이 렌더하면 런타임 오류 발생.

### 4. .env.local.example 업데이트

파일: `mobile/.env.local.example`

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
EXPO_PUBLIC_MAPBOX_TOKEN=<your-mapbox-public-token>
```

### 5. Jest 목 업데이트

`@rnmapbox/maps`는 네이티브 모듈을 사용하므로 Jest 테스트에서 목이 필요하다.

Jest 설정 파일(package.json의 `jest.setupFilesAfterFramework` 또는 별도 setup 파일)에 추가하거나,
`mobile/src/__mocks__/@rnmapbox/maps.ts` 파일을 생성하라:

```typescript
export default {
  setAccessToken: jest.fn(),
  MapView: 'MapboxGL.MapView',
  Camera: 'MapboxGL.Camera',
  UserLocation: 'MapboxGL.UserLocation',
  PointAnnotation: 'MapboxGL.PointAnnotation',
  Callout: 'MapboxGL.Callout',
};
```

기존 `react-native-maps` 목이 있으면 제거하라.

## Acceptance Criteria

```bash
cd mobile && npm run lint   # ESLint 오류 없음
cd mobile && npm test       # 기존 테스트 전체 통과
```

네이티브 빌드 확인 (전제 조건 토큰 설정 후):
```bash
cd mobile && npx expo run:ios
# 지도 화면에서 다크 스타일 지도 + 사용자 위치 파란 점 표시 확인
```

## 검증 절차

1. `npm run lint && npm test` 실행 — 기존 OnDutyToggle.test.tsx 등 전체 통과 확인
2. 아키텍처 체크리스트:
   - `react-native-maps`가 package.json에서 제거됐는가?
   - LocationMap props 인터페이스가 기존과 동일한가 (TravelerScreen 수정 없이 동작)?
   - `EXPO_PUBLIC_MAPBOX_TOKEN`이 `.env.local.example`에 플레이스홀더로 추가됐는가?
   - `EXPO_PUBLIC_MAPBOX_TOKEN`이 실제 값으로 코드에 하드코딩되지 않았는가?
   - `expo-secure-store` 규칙: JWT는 여전히 SecureStore에만 있는가? (이 step에서 변경 없음)
3. 결과에 따라 `phases/8-map-spatial-upgrade/index.json`의 step 2를 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "react-native-maps → @rnmapbox/maps 교체, dark-v11 스타일 + UserLocation + PointAnnotation, .env.local.example 토큰 플레이스홀더 추가"`
   - 토큰 미설정 → `"status": "blocked"`, `"blocked_reason": "Mapbox 계정 및 토큰 미설정 (step2.md 전제 조건 참고)"`
   - 빌드 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- Mapbox 토큰(`pk.ey...` 또는 `sk.ey...`)을 코드, app.json, .env.local.example에 실제 값으로 커밋하지 마라.
- `EXPO_PUBLIC_MAPBOX_TOKEN`을 소스 코드에 하드코딩하지 마라. 반드시 `process.env.EXPO_PUBLIC_MAPBOX_TOKEN`으로 읽어라.
- LocationMap의 Props 인터페이스를 변경하지 마라. TravelerScreen 등 호출부가 수정 없이 동작해야 한다.
- `AsyncStorage`에 토큰을 저장하지 마라 (CLAUDE.md CRITICAL 규칙).
- `fetch`/`axios`를 LocationMap 내부에서 직접 호출하지 마라.
- 기존 테스트를 깨뜨리지 마라.
