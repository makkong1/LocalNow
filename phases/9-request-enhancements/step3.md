# Step 3: mobile-traveler-location

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 구현을 파악하라:

- `/docs/UI_GUIDE.md` — 다크 테마, amber/orange 포인트 컬러 규칙
- `/mobile/src/components/RequestForm.tsx` — 여행자 도움 요청 생성 폼 (전체)
- `/mobile/src/components/LocationMap.tsx` — @maplibre/maplibre-react-native 래퍼
- `/mobile/src/screens/TravelerScreen.tsx` — RequestForm을 사용하는 화면
- `/mobile/src/lib/api-client.ts` — fetch 래퍼 구조 파악 (Nominatim 호출에는 사용 안 함)
- `/mobile/package.json` — expo-location 설치 여부 확인

## 배경

현재 RequestForm에서 위치 기본값은 서울 강남역 좌표(`lat: 37.5665, lng: 126.978`)로 하드코딩돼 있다. 여행자가 실제로 도움이 필요한 장소를 더 직관적으로 입력하도록 두 가지를 개선한다:

1. **GPS 자동감지**: 폼이 열릴 때 `expo-location`으로 현재 GPS 위치를 가져와 지도 핀 기본값으로 설정한다.
2. **주소 검색**: 텍스트로 장소명(예: "경복궁", "Gyeongbokgung")을 검색하면 Nominatim API가 좌표를 반환하고, 선택 시 지도 핀이 이동한다.

## 전제 조건 확인

`expo-location`이 설치돼 있는지 확인하라. `mobile/package.json`에 없다면:
```bash
npx expo install expo-location
```

## 작업

### 1. GPS 자동감지 — RequestForm 초기화

파일: `mobile/src/components/RequestForm.tsx`

폼 마운트 시(`useEffect`) GPS 위치를 요청하라:

```typescript
import * as Location from 'expo-location';

// 폼 마운트 시 한 번 실행
useEffect(() => {
  (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;  // 거부 시 기존 폴백 좌표 유지
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLat(position.coords.latitude);
    setLng(position.coords.longitude);
  })();
}, []);
```

- 권한이 거부되거나 위치 획득 실패 시 기존 강남역 폴백 좌표를 유지한다.
- 위치 로딩 중 지도 위에 `ActivityIndicator`를 표시하면 좋다 (필수는 아님).

### 2. 주소 검색 바 추가

파일: `mobile/src/components/RequestForm.tsx`

지도 컴포넌트(`LocationMap`) 위에 검색 입력 바를 추가하라:

**검색 UX 흐름**:
1. 텍스트 입력 → 디바운스 500ms → Nominatim API 호출
2. 결과 드롭다운(최대 5개) 표시
3. 결과 선택 → `lat`/`lng` 상태 업데이트 → 지도 핀 이동 → 드롭다운 닫힘

**Nominatim API 호출** (`fetch` 직접 사용 — 외부 공개 API이며 백엔드를 거치지 않음):

```typescript
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

async function searchAddress(query: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    'accept-language': 'ko,en',
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': 'LocalNow/1.0 (contact: localnow@example.com)' },
  });
  return res.json();
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}
```

**Nominatim 이용 약관**: User-Agent 헤더를 반드시 포함하라. 반복 자동 요청 금지 (디바운스로 충족됨).

**UI 스타일**:
- 검색 바: `#1c1c1c` 배경, `#262626` 테두리, `#fff` 텍스트
- 드롭다운: 절대 위치(지도 위 오버레이), `#141414` 배경, 각 결과는 `TouchableOpacity`
- `display_name`이 길면 한 줄로 잘라 표시 (numberOfLines={1})

### 3. RequestForm props 변경 없음

LocationMap의 props 인터페이스(`{lat, lng, onLocationChange?, markers?}`)는 변경하지 마라. 지도 탭으로 위치 변경하는 기존 동작도 그대로 유지한다.

## Acceptance Criteria

```bash
cd mobile && npm run lint     # ESLint 오류 없음
cd mobile && npm test         # 전체 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - 권한 거부 시 기존 폴백 좌표(강남역)가 그대로 사용되는가?
   - 검색 바에 텍스트 입력 후 결과 드롭다운이 표시되는가?
   - 결과 선택 시 지도 핀이 이동하는가?
   - 지도 직접 탭으로 위치 변경이 여전히 동작하는가?
   - User-Agent 헤더가 Nominatim 요청에 포함되는가?
   - `EXPO_PUBLIC_*` 환경변수에 Nominatim URL이 없는가 (공개 URL이므로 하드코딩 허용)?
3. 결과에 따라 `phases/9-request-enhancements/index.json`의 step 3을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "RequestForm GPS 자동감지 기본값, Nominatim 주소 검색 바 추가. 기존 지도 탭 동작 유지"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- Nominatim API 키를 `.env.local`이나 코드에 추가하지 마라. Nominatim은 무료 공개 API로 키가 없다.
- Nominatim 응답을 `api-client.ts`를 통해 호출하지 마라. `api-client.ts`는 로컬 백엔드용이다. Nominatim은 직접 `fetch`로 호출한다.
- LocationMap props 인터페이스를 변경하지 마라. TravelerScreen 등 호출부가 수정 없이 동작해야 한다.
- GPS 위치를 `EXPO_PUBLIC_*` 환경변수로 저장하지 마라.
- 기존 테스트를 깨뜨리지 마라.
