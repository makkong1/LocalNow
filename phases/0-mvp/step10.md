# Step 10: web-guide

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/UI_GUIDE.md`
- `/docs/API_CONVENTIONS.md`
- `/web/src/types/api.ts`
- `/web/src/lib/api-client.ts`
- `/web/src/app/api/requests/route.ts` (여행자 step에서 완성된 버전)
- `/web/src/app/api/guide/duty/route.ts` (스텁 확인)

이전 step에서 완성된 Route Handler와 타입을 읽고, 가이드 뷰에 필요한 부분을 파악한 뒤 작업하라.

## 작업

가이드 뷰(`/guide`): on-duty 토글, 실시간 요청 목록, 수락 버튼까지 구현한다.
on-duty ON 시 `RedisGeoService`에 가이드 위치를 등록해 주변 요청 매칭 대상이 된다.

### 1. Route Handler 완성

#### `app/api/guide/duty/route.ts`
- `POST`: body `{ onDuty: boolean, lat?: number, lng?: number }` → 백엔드 신규 엔드포인트 `POST /guide/duty` 프록시.

  **백엔드 엔드포인트 추가 필요 사항** (이 step에서 직접 추가):
  이 엔드포인트는 이전 백엔드 step에서 빠진 부분이다. 백엔드에 아래를 추가한다:

  `user/controller/GuideController.java`:
  ```java
  @PostMapping("/guide/duty")
  // body: { onDuty: boolean, lat: double, lng: double }
  // onDuty=true → RedisGeoService.addGuide(guideId, lat, lng)
  // onDuty=false → RedisGeoService.removeGuide(guideId)
  // GUIDE 역할만 접근 가능
  ```

  이 컨트롤러는 UserService 또는 RedisGeoService를 직접 호출해도 된다 (단순 위치 등록이므로 별도 서비스 계층이 과하다).

#### `app/api/requests/[id]/accept/route.ts`
- `POST`: body `{ message? }` → 백엔드 `POST /requests/{id}/accept` 프록시.

### 2. `app/guide/page.tsx` (Server Component)

- 미인증 시 `/login`으로 redirect.
- `role != GUIDE`이면 `/traveler`로 redirect.
- 레이아웃: `grid-cols-12`. 좌측(col-span-4): on-duty 패널 + 연결 상태. 우측(col-span-8): 요청 목록.

### 3. Client Component: `components/client/OnDutyToggle.tsx`

```typescript
// Props: initialOnDuty: boolean
```

- 토글 스위치 UI (amber 색 활성 상태).
- ON 전환 시:
  1. `navigator.geolocation.getCurrentPosition`으로 현재 위치 취득.
  2. `POST /api/guide/duty` `{ onDuty: true, lat, lng }`.
- OFF 전환 시:
  - `POST /api/guide/duty` `{ onDuty: false }`.
- 위치 취득 실패 시 에러 메시지 표시. 토글 상태 복원.
- 로딩 중 비활성화.

### 4. Client Component: `components/client/RequestCard.tsx`

```typescript
// Props: request: HelpRequestResponse, onAccept: (requestId: number) => void, isAccepting: boolean
```

- 요청 유형, 거리(가이드 현재 위치 기준 km), 소요시간, 제안 금액 표시.
- 거리는 가이드 현재 위치와 요청 `lat`, `lng`을 Haversine 공식으로 계산.
- "수락" Secondary 버튼 → `onAccept(request.id)`.
- `isAccepting=true`이면 버튼 disabled.
- 상태 뱃지: UI_GUIDE.md 상태 색 매핑 (`OPEN` → yellow-500).
- 카드 스타일: UI_GUIDE.md 카드 토큰.

### 5. 가이드 뷰 데이터 흐름

```
GuideView (Client Component, "use client")
├── OnDutyToggle
├── STOMP 구독: /topic/guides/{userId}  ← notification 도메인이 발행하는 이벤트
│   이벤트 타입:
│   - NEW_REQUEST: 요청 목록에 추가
│   - MATCH_CONFIRMED: "매칭 확정됨" 알림 표시
└── RequestList
    └── RequestCard 목록
        └── "수락" 버튼 → POST /api/requests/{id}/accept
            → 성공 시 해당 카드에 "수락 완료" 상태 표시
```

**STOMP 구독 방법**:
- `lib/stomp-client.ts`는 Step 11에서 만든다. 이 step에서는 **STOMP 없이 폴링으로 구현**한다.
- `useQuery(['nearbyRequests'], GET /api/requests?status=OPEN, { refetchInterval: 3000 })`.
- Step 11에서 ChatPanel과 함께 STOMP 구독으로 교체한다.

### 6. 테스트

`components/client/__tests__/OnDutyToggle.test.tsx` (Vitest + RTL):
- 토글 ON → geolocation 요청 → `POST /api/guide/duty` 호출 확인
- geolocation 실패 → 에러 메시지 표시, 토글 상태 복원

`components/client/__tests__/RequestCard.test.tsx` (Vitest + RTL):
- "수락" 버튼 클릭 → `onAccept` 호출
- `isAccepting=true` → 버튼 disabled

## Acceptance Criteria

```bash
# 백엔드 GuideController 추가 포함
cd backend && ./gradlew check

# 웹 빌드
cd web && npm run lint && npm run build
```

## 검증 절차

1. 두 AC 커맨드 모두 실행.
2. 체크리스트:
   - `OnDutyToggle`이 위치 없이 on-duty를 ON하지 않는가? (geolocation 실패 시 복원)
   - 거리 계산이 Haversine 공식 기반인가? (단순 유클리드 거리 금지)
   - STOMP 없이 3초 폴링으로 동작하는가? (Step 11에서 교체 예정)
3. `phases/0-mvp/index.json` step 10 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "가이드 뷰(/guide) 완성: OnDutyToggle(위치 등록/해제), RequestCard(수락), 3초 폴링 요청 목록. 백엔드 GuideController(/guide/duty) 추가. ./gradlew check + npm run build 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- `OnDutyToggle`이 on-duty=true 상태에서 위치 취득 실패 시 Redis에 등록하지 마라. 이유: 위치 없는 가이드가 GEO 인덱스에 들어가면 매칭 대상이 되어선 안 된다.
- 가이드 뷰에서 STOMP 연결을 이 step에서 구현하지 마라. 이유: Step 11(web-chat)에서 stomp-client.ts와 함께 통합한다. 지금은 폴링으로 충분하다.
- 기존 테스트를 깨뜨리지 마라.
