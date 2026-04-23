# Step 9: web-traveler

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ADR.md` (ADR-008: Leaflet, ADR-009: BFF, ADR-010: TanStack Query)
- `/docs/UI_GUIDE.md`
- `/docs/API_CONVENTIONS.md`
- `/web/src/types/api.ts`
- `/web/src/lib/api-client.ts`
- `/web/src/lib/cookies.ts`
- `/web/src/app/api/requests/route.ts`
- `/web/src/app/api/requests/[id]/offers/route.ts`
- `/web/src/app/api/requests/[id]/confirm/route.ts`

이전 step에서 만들어진 Route Handler 스텁들을 먼저 읽고, 실제 백엔드 호출로 완성한 뒤 여행자 뷰를 구현하라.

## 작업

여행자 뷰(`/traveler`): 도움 요청 생성, 후보 가이드 목록 확인, 확정까지의 흐름과 지도를 구현한다.

### 1. Route Handler 완성 (스텁 → 실제 구현)

#### `app/api/requests/route.ts`
- `GET`: 쿠키에서 토큰 꺼내 백엔드 `GET /auth/me` → `GET /requests/me?cursor=...&size=10` 프록시.
- `POST`: body를 백엔드 `POST /requests`로 프록시.

#### `app/api/requests/[id]/route.ts`
- `GET`: 백엔드 `GET /requests/{id}` 프록시.

#### `app/api/requests/[id]/offers/route.ts`
- `GET`: 백엔드 `GET /requests/{id}/offers` 프록시.

#### `app/api/requests/[id]/confirm/route.ts`
- `POST`: body `{ guideId }` → 백엔드 `POST /requests/{id}/confirm` 프록시.

#### `app/api/requests/[id]/review/route.ts`
- `POST`: body `{ rating, comment }` → 백엔드 `POST /requests/{id}/review` 프록시.

#### `app/api/payments/intent/route.ts`
- `POST`: body `{ requestId }` → 백엔드 `POST /payments/intent` 프록시.

#### `app/api/payments/[requestId]/capture/route.ts`
- `POST`: 백엔드 `POST /payments/{requestId}/capture` 프록시.

### 2. `app/traveler/page.tsx` (Server Component)

- 미인증 시 `/login`으로 redirect.
- `role != TRAVELER`이면 `/guide`로 redirect.
- 레이아웃: `grid-cols-12`. 좌측(col-span-7): 지도 + 요청 폼. 우측(col-span-5): 내 요청 상태 패널.

### 3. Client Component: `components/client/RequestForm.tsx`

```typescript
// Props: onSuccess: (request: HelpRequestResponse) => void
```

- `requestType`(select), `description`(textarea), `startAt`(datetime-local), `durationMin`(number), `budgetKrw`(number) 입력.
- `lat`, `lng`는 브라우저 `navigator.geolocation.getCurrentPosition`으로 자동 취득. 실패 시 기본값(서울 시청 좌표) 사용.
- `POST /api/requests` → 성공 시 `onSuccess` 콜백.
- TanStack Query `useMutation` 사용.
- UI_GUIDE.md 입력 필드 + Primary 버튼 스타일.

### 4. Client Component: `components/client/LocationMap.tsx`

- Leaflet + react-leaflet.
- `next/dynamic({ ssr: false })`으로 SSR 비활성화 (Leaflet은 브라우저 전용).
- 다크 타일: `https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`.
- Props: `lat`, `lng`, `guides?: Array<{ id, lat, lng }>`.
- 내 위치: amber 마커. 가이드 위치: 흰색 마커.
- 컨테이너: UI_GUIDE.md 지도 스타일 (`rounded-lg overflow-hidden border border-neutral-800`).

### 5. Client Component: `components/client/GuideOfferCard.tsx`

```typescript
// Props: offer: MatchOfferResponse, onConfirm: (guideId: number) => void, isPending: boolean
```

- 가이드 이름, 평균 평점(별점 아이콘), 메시지 표시.
- "이 가이드로 확정" Primary 버튼 → `onConfirm(offer.guideId)`.
- `isPending=true`이면 버튼 disabled (낙관적 UI).
- 카드 스타일: UI_GUIDE.md 카드 토큰 (`rounded-lg bg-[#141414] border border-neutral-800 p-6`).

### 6. Client Component: `components/client/ReviewForm.tsx`

```typescript
// Props: requestId: number, onSuccess: () => void
```

- 별점(1~5, 클릭 선택), comment textarea.
- `POST /api/requests/{id}/review`.
- 요청 status가 COMPLETED일 때만 표시 (부모 컴포넌트에서 조건부 렌더).

### 7. 여행자 뷰 데이터 흐름 (`app/traveler/page.tsx` 하위)

```
TravelerView (Client Component, "use client")
├── LocationMap
├── RequestForm (요청 생성 폼)
└── MyRequestPanel
    ├── HelpRequestStatus 뱃지 (UI_GUIDE.md 상태 색상)
    ├── GuideOfferCard 목록 (status=OPEN일 때)
    │   └── "이 가이드로 확정" → POST /api/requests/{id}/confirm
    │       → 성공 시 status=MATCHED, 결제 의도 자동 생성(POST /api/payments/intent)
    ├── 결제 상태 표시 (status=MATCHED일 때)
    │   └── "결제 완료(Mock)" 버튼 → POST /api/payments/{id}/capture
    └── ReviewForm (status=COMPLETED일 때)
```

**TanStack Query 사용 규칙**:
- `useQuery(['myRequests'])`: `GET /api/requests` 폴링 (refetchInterval: 5000ms — STOMP 연결 전 폴백).
- `useQuery(['offers', requestId])`: `GET /api/requests/{id}/offers`.
- `useMutation`: confirm, capture, review.
- 서버 응답 타입은 반드시 `types/api.ts`의 타입 사용.

### 8. 테스트

`components/client/__tests__/GuideOfferCard.test.tsx` (Vitest + RTL):
- "이 가이드로 확정" 버튼 클릭 시 `onConfirm` 호출 확인
- `isPending=true`이면 버튼 disabled

## Acceptance Criteria

```bash
cd web && npm run lint && npm run build
```

## 검증 절차

1. `npm run lint && npm run build` 실행.
2. 체크리스트:
   - `LocationMap`이 `next/dynamic({ ssr: false })`으로 감싸져 있는가? (Leaflet SSR 오류 방지)
   - 브라우저 컴포넌트가 백엔드를 직접 fetch하지 않고 `/api/**`를 경유하는가?
   - `budgetKrw`를 입력받을 때 정수로만 처리하는가? (소수점 입력 방지)
   - UI_GUIDE.md 금지 패턴이 없는가?
3. `phases/0-mvp/index.json` step 9 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "여행자 뷰(/traveler) 완성: LocationMap(Leaflet), RequestForm, GuideOfferCard, ReviewForm + Route Handler 실구현. TanStack Query 데이터 페칭. npm run build 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- `LocationMap`을 SSR로 렌더하지 마라. 이유: Leaflet이 `window` 객체를 필요로 해 서버에서 실행 시 ReferenceError가 발생한다.
- 클라이언트 컴포넌트에서 `BACKEND_BASE_URL`을 직접 참조하지 마라. 이유: 백엔드 URL이 브라우저 번들에 노출된다. 반드시 `/api/**` Route Handler를 경유해야 한다.
- `budgetKrw`를 float/string으로 처리하지 마라. 이유: API_CONVENTIONS.md는 금액을 Long 정수로 규정한다.
- 기존 테스트를 깨뜨리지 마라.
