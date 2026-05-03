# Step 4: mobile-guide-baseloc

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 구현을 파악하라:

- `/docs/UI_GUIDE.md` — 다크 테마, amber/orange 포인트 컬러 규칙
- `/mobile/src/screens/ProfileEditScreen.tsx` — 현재 프로필 편집 화면 구조
- `/mobile/src/screens/GuideScreen.tsx` — step 2에서 수정된 GuideScreen (필터/정렬 포함)
- `/mobile/src/hooks/useRequests.ts` — step 2에서 수정된 useOpenRequests
- `/mobile/src/hooks/useGuide.ts` — 현재 가이드 훅 (useSetDuty 등)
- `/mobile/src/components/LocationMap.tsx` — @maplibre/maplibre-react-native 래퍼
- `/mobile/src/lib/api-client.ts` — fetch 래퍼
- `/mobile/src/types/api.ts` — 기존 타입 정의

이전 step들에서 완료된 변경사항:
- step 0: 백엔드 `GET /requests/open`에 `lat`, `lng` 파라미터 추가
- step 1: 백엔드 `PUT/GET /guides/me/base-location` 엔드포인트 추가
- step 2: GuideScreen 필터 칩 + 정렬 UI 추가 (`lat/lng`는 아직 전달 안 함)

## 배경

가이드가 ProfileEditScreen에서 "활동 거점"을 지도로 선택해 저장하고, GuideScreen에서 주변 요청을 볼 때 저장된 거점 위치를 자동으로 검색 기준으로 사용한다.

거점이 미설정 상태이면 현재 GPS 위치를 기준으로 한다. 두 가지 모두 없으면 위치 없이(기존 커서 페이지네이션) 요청 목록을 표시한다.

## 작업

### 1. API 타입 추가

파일: `mobile/src/types/api.ts`

```typescript
export interface BaseLocationResponse {
  lat: number;
  lng: number;
}
```

### 2. useGuide 훅 — 거점 관련 훅 추가

파일: `mobile/src/hooks/useGuide.ts`

기존 파일에 아래 훅을 추가하라:

```typescript
// 거점 위치 조회
export function useGuideBaseLocation() {
  return useQuery<BaseLocationResponse | null>({
    queryKey: ['guide', 'base-location'],
    queryFn: async () => {
      const res = await apiFetch<BaseLocationResponse>('/guides/me/base-location');
      if (!res.success) return null;  // 204 (미설정) 시 null
      return res.data ?? null;
    },
  });
}

// 거점 위치 저장
export function useSaveGuideBaseLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { lat: number; lng: number }) => {
      const res = await apiFetch<void>('/guides/me/base-location', { method: 'PUT', body });
      if (!res.success) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guide', 'base-location'] }),
  });
}
```

### 3. ProfileEditScreen — 활동 거점 섹션 추가

파일: `mobile/src/screens/ProfileEditScreen.tsx`

가이드 역할(`role === 'GUIDE'`)일 때만 렌더되는 "활동 거점" 섹션을 기존 프로필 폼 아래에 추가하라.

**섹션 구조**:
- 제목: "활동 거점" (회색 레이블)
- 현재 거점 표시: 좌표 문자열 또는 "미설정" 텍스트
- "거점 설정" 버튼 → `BaseLocationModal` 표시

**BaseLocationModal** (같은 파일에 컴포넌트로 작성, 또는 별도 파일):
- `Modal` (전체 화면)
- Nominatim 주소 검색 바 (step 3의 searchAddress 함수를 공통 유틸로 분리하거나 동일하게 구현)
- `LocationMap` 컴포넌트 — 탭으로 위치 선택 (`onLocationChange` prop 사용)
- "저장" 버튼 → `useSaveGuideBaseLocation` mutate → 모달 닫기
- "취소" 버튼

### 4. GuideScreen — 거점 위치를 주변 요청 검색에 연결

파일: `mobile/src/screens/GuideScreen.tsx`

`OpenRequestsView` 컴포넌트를 수정하라.

**위치 우선순위**:
1. 가이드의 저장된 거점 위치(`useGuideBaseLocation`)
2. 없으면 → GPS 현재 위치 (`expo-location` 한 번만 읽기, useEffect)
3. 둘 다 없으면 → `lat/lng` 없이 호출 (기존 커서 페이지네이션)

```typescript
const { data: baseLoc } = useGuideBaseLocation();
const [gpsLoc, setGpsLoc] = useState<{ lat: number; lng: number } | null>(null);

useEffect(() => {
  if (baseLoc) return;  // 거점이 있으면 GPS 불필요
  Location.requestForegroundPermissionsAsync().then(({ status }) => {
    if (status !== 'granted') return;
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(pos => {
      setGpsLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  });
}, [baseLoc]);

const searchLoc = baseLoc ?? gpsLoc ?? null;

const { data: requestsPage, isLoading } = useOpenRequests({
  enabled: true,
  refetchInterval: 10000,
  requestType: selectedType,
  sortBy,
  lat: searchLoc?.lat,
  lng: searchLoc?.lng,
  radiusKm: 5.0,
});
```

`expo-location`은 이미 설치돼 있다 (step 3 확인).

## Acceptance Criteria

```bash
cd mobile && npm run lint     # ESLint 오류 없음
cd mobile && npm test         # 전체 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - ProfileEditScreen에서 GUIDE 역할일 때만 "활동 거점" 섹션이 보이는가?
   - 거점 저장 후 `['guide', 'base-location']` 쿼리가 invalidate되는가?
   - GuideScreen에서 저장된 거점이 있으면 GPS보다 거점을 우선 사용하는가?
   - 거점과 GPS 모두 없을 때 위치 없이 요청 목록을 불러오는가?
   - `apiFetch`가 204 응답 시 null을 반환해도 훅이 오류 없이 처리되는가?
3. 결과에 따라 `phases/9-request-enhancements/index.json`의 step 4를 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "ProfileEditScreen 활동 거점 설정 UI, useGuideBaseLocation/useSaveGuideBaseLocation 훅 추가. GuideScreen 거점→GPS→없음 우선순위로 주변 요청 검색 연결"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- `EXPO_PUBLIC_*` 환경변수에 거점 좌표를 저장하지 마라. 사용자별 데이터는 API에서 가져온다.
- `AsyncStorage`에 거점 위치를 로컬 캐시하지 마라. TanStack Query 캐시로 충분하다.
- TRAVELER 역할에게 거점 설정 UI를 보여주지 마라.
- 기존 테스트를 깨뜨리지 마라.
