# Step 4: guide-screens

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/API_CONVENTIONS.md`
- `/docs/UI_GUIDE.md`
- `/mobile/src/types/api.ts`
- `/mobile/src/hooks/useRequests.ts`
- `/mobile/src/hooks/useMatches.ts`
- `/mobile/src/hooks/useGuide.ts`
- `/mobile/src/hooks/useAuth.ts`
- `/backend/src/main/java/com/localnow/user/controller/GuideController.java` (온듀티 API 계약)

## 작업

가이드 핵심 플로우를 구현한다: 온듀티 토글 → 주변 요청 실시간 수신 → 요청 수락.

### 1. `mobile/src/screens/GuideScreen.tsx`

가이드 통합 뷰:

| 상태 | 표시 |
|------|------|
| 오프듀티 | "근무 시작" 버튼만 표시 |
| 온듀티 | 온듀티 뱃지 + 주변 요청 목록 + "근무 종료" 버튼 |
| 수락한 요청이 MATCHED | 채팅 탭 이동 안내 |

`useOpenRequests()` 로 열린 요청을 폴링 (기본 10초). STOMP 이벤트(step 5 에서 연결)로 즉시 갱신.
위치 기반 반경 필터는 백엔드 `GET /requests/open` 계약이 확장될 때 추가한다.

### 2. `mobile/src/components/OnDutyToggle.tsx`

```typescript
interface OnDutyToggleProps {
  isOnDuty: boolean;
  onToggle: (onDuty: boolean, location?: { lat: number; lng: number }) => void;
  isLoading: boolean;
}
```
- `Switch` 또는 큰 토글 버튼 UI.
- 온듀티로 전환 시 `expo-location` 으로 현재 위치 획득 후 `useSetDuty({ onDuty: true, lat, lng })`.
- 위치 권한 거부 시 Alert 으로 "근무 시작에는 위치 권한이 필요합니다" 표시 후 토글 취소.
- 오프듀티 전환 시 위치 불필요: `useSetDuty({ onDuty: false })`.

### 3. `mobile/src/components/RequestCard.tsx`

```typescript
interface RequestCardProps {
  request: HelpRequestResponse;
  onAccept: (requestId: number) => void;
  isAccepting: boolean;
  distanceKm?: number;
}
```
- 요청 유형 (색상 뱃지: EMERGENCY → amber 강조), 설명, 제안 금액(KRW), 소요 시간, 거리 표시.
- "수락하기" 버튼 → `useAcceptRequest().mutate({ requestId })`.
- 이미 수락한 요청이면 버튼을 "수락 완료" 로 표시하고 비활성화.

### 4. `mobile/src/components/StatusBadge.tsx`

```typescript
interface StatusBadgeProps {
  status: HelpRequestStatus | MatchOfferStatus;
  size?: 'sm' | 'md';
}
```
- 상태별 배경색/텍스트 매핑:
  - `OPEN` → amber
  - `MATCHED`, `CONFIRMED` → green
  - `IN_PROGRESS` → blue
  - `COMPLETED` → gray
  - `CANCELLED`, `REJECTED` → red
- `UI_GUIDE.md` 의 컬러 토큰을 따른다. 보라/인디고 금지.

### 5. 테스트

`mobile/src/__tests__/RequestCard.test.tsx`:
- "수락하기" 버튼 클릭 시 `onAccept(request.id)` 가 호출된다.
- `isAccepting: true` 일 때 버튼이 비활성화된다.
- EMERGENCY 타입일 때 amber 강조 스타일이 적용된다.

`mobile/src/__tests__/OnDutyToggle.test.tsx`:
- 토글 활성화 시 `onToggle(true, location)` 이 호출된다.
- 토글 비활성화 시 `onToggle(false)` 이 호출된다.

## Acceptance Criteria

```bash
cd mobile && npm test       # RequestCard, OnDutyToggle 테스트 통과
cd mobile && npm run lint   # 에러 0
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `OnDutyToggle` 이 위치 권한 없이는 온듀티 전환을 시도하지 않는가?
   - `RequestCard` 가 `status !== 'OPEN'` 인 요청에 수락 버튼을 노출하지 않는가?
   - `GuideScreen` 이 `useOpenRequests()` 훅을 사용하고 컴포넌트에서 직접 `apiFetch` 를 호출하지 않는가?
3. `phases/1-mobile-app/index.json` step 4 업데이트.

## 금지사항

- `expo-location` 없이 위치를 하드코딩하지 마라. 이유: 가이드 매칭의 핵심은 실제 위치다.
- 기존 `backend/` 및 `web/` 코드를 수정하지 마라. 백엔드 모바일 지원은 step 2 에서 끝낸다.
