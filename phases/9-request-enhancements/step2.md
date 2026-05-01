# Step 2: mobile-filter-sort

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 구현을 파악하라:

- `/docs/UI_GUIDE.md` — 다크 테마, amber/orange 포인트 컬러 규칙
- `/mobile/src/screens/GuideScreen.tsx` — 현재 가이드 화면 구조
- `/mobile/src/hooks/useRequests.ts` — useOpenRequests 현재 구현
- `/mobile/src/types/api.ts` — RequestType, HelpRequestResponse 타입
- `/mobile/src/components/RequestCard.tsx` — 요청 카드 컴포넌트

이전 step들에서 완료된 변경사항:
- step 0: 백엔드 `GET /requests/open`에 `requestType`, `sortBy`, `lat`, `lng`, `radiusKm` 파라미터 추가
- step 1: `PUT/GET /guides/me/base-location` 엔드포인트 추가

## 배경

가이드가 주변 도움 요청 목록에서 카테고리(requestType)로 필터하고, 가격(budgetKrw) 기준으로 정렬할 수 있어야 한다. 이 step은 모바일 UI만 수정하며, 백엔드에는 step 0에서 이미 파라미터가 추가됐다.

## 작업

### 1. useOpenRequests 훅 업데이트

파일: `mobile/src/hooks/useRequests.ts`

`useOpenRequests`의 옵션 타입을 확장하라:

```typescript
interface OpenRequestsOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
  requestType?: RequestType | null;  // null = 전체
  sortBy?: 'budgetAsc' | 'budgetDesc' | null;  // null = 기본(id DESC)
  lat?: number;
  lng?: number;
  radiusKm?: number;
}
```

queryFn 내부에서 URLSearchParams로 파라미터를 조립해 `/requests/open?requestType=...&sortBy=...&lat=...&lng=...&radiusKm=...` 형태로 호출하라. null/undefined 값은 파라미터에서 제외한다.

`queryKey`에도 filter/sort 값을 포함시켜 캐시가 옵션별로 분리되게 하라:
```typescript
queryKey: ['requests', 'open', { requestType, sortBy, lat, lng }]
```

### 2. GuideScreen — 필터 및 정렬 UI 추가

파일: `mobile/src/screens/GuideScreen.tsx`의 `OpenRequestsView` 컴포넌트

`OpenRequestsView`에 아래 로컬 상태를 추가하라:

```typescript
const [selectedType, setSelectedType] = useState<RequestType | null>(null);
const [sortBy, setSortBy] = useState<'budgetAsc' | 'budgetDesc' | null>(null);
```

**필터 칩 UI** — `useOpenRequests` 위에 수평 ScrollView로 배치:
- 칩 목록: `전체`, `가이드`, `통역`, `음식`, `긴급` (각각 null, GUIDE, TRANSLATION, FOOD, EMERGENCY)
- 선택된 칩: amber 배경(`#f59e0b`) + 검정 텍스트
- 미선택 칩: `#1c1c1c` 배경 + `#a3a3a3` 텍스트, 테두리 `#262626`

**정렬 버튼** — 필터 칩 오른쪽 끝에 배치:
- `기본` → `↑가격` → `↓가격` 순으로 토글
- 현재 정렬 상태 표시 (아이콘 또는 텍스트)

`useOpenRequests` 호출에 `selectedType`과 `sortBy`를 전달하라:
```typescript
const { data: requestsPage, isLoading } = useOpenRequests({
  enabled: true,
  refetchInterval: 10000,
  requestType: selectedType,
  sortBy,
});
```

`lat`, `lng`는 이 step에서 전달하지 않는다. step 4에서 거점 위치를 연결한다.

### 3. RequestCard — 가격 표시 개선 (선택)

파일: `mobile/src/components/RequestCard.tsx`

`budgetKrw` 값이 정렬의 기준이 되므로, 카드에서 가격이 눈에 잘 띄게 표시되고 있는지 확인하라. 이미 표시된다면 그대로 유지한다.

## Acceptance Criteria

```bash
cd mobile && npm run lint     # ESLint 오류 없음
cd mobile && npm test         # 전체 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - 필터 칩이 수평 스크롤로 표시되는가?
   - 칩 선택 시 amber 색상으로 강조되는가?
   - 정렬 버튼이 기본→가격↑→가격↓ 순으로 토글되는가?
   - queryKey에 filter/sort 값이 포함돼 별도 캐시 항목으로 저장되는가?
   - lat/lng 없이도 호출이 정상 동작하는가 (step 4 전까지는 위치 파라미터 없음)?
3. 결과에 따라 `phases/9-request-enhancements/index.json`의 step 2를 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "GuideScreen에 requestType 필터 칩, sortBy 정렬 토글 UI 추가. useOpenRequests 옵션 확장"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- 컴포넌트 내부에서 `fetch`/`axios`를 직접 호출하지 마라. 반드시 `useOpenRequests` 훅을 통해라.
- `api.ts`에 없는 임시 인터페이스를 컴포넌트 내부에 정의하지 마라. `RequestType`은 이미 `types/api.ts`에 있다.
- lat/lng를 이 step에서 하드코딩하지 마라. step 4에서 연결한다.
- 기존 테스트를 깨뜨리지 마라.
