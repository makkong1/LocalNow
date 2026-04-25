# Step 3: traveler-screens

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/UI_GUIDE.md` (디자인 원칙)
- `/docs/API_CONVENTIONS.md`
- `/mobile/src/types/api.ts`
- `/mobile/src/hooks/useRequests.ts`
- `/mobile/src/hooks/useMatches.ts`
- `/mobile/src/hooks/usePayment.ts`
- `/mobile/src/hooks/useReview.ts`
- `/mobile/src/lib/api-client.ts`

## 작업

여행자 핵심 플로우의 요청/오퍼/확정 UI 를 구현한다: 위치 기반 도움 요청 생성 → 가이드 오퍼 선택 → 확정.
Mock 결제와 리뷰 화면의 완성 구현은 step 6 에서 진행한다.

### 1. `mobile/src/screens/TravelerScreen.tsx`

여행자 통합 뷰. 요청 상태에 따라 아래 UI 상태를 전환한다:

| 상태 | 표시 |
|------|------|
| 요청 없음 | 지도 + "도움 요청하기" 버튼 |
| OPEN (오퍼 대기) | 요청 상태 카드 + 오퍼 목록 |
| OPEN (오퍼 존재) | 오퍼 카드 목록 + "이 가이드로 확정" 버튼 |
| MATCHED / IN_PROGRESS | 채팅 화면 링크 + 결제 화면 이동 버튼 |
| COMPLETED | 리뷰 화면 이동 버튼 또는 완료 안내 |

`useMyRequests()` 로 내 최근 활성 요청을 가져와 상태 전환.

### 2. `mobile/src/components/LocationMap.tsx`

`react-native-maps` 기반 지도 컴포넌트:
```typescript
interface LocationMapProps {
  lat: number;
  lng: number;
  onLocationChange?: (lat: number, lng: number) => void;
  markers?: Array<{ id: string; lat: number; lng: number; title: string }>;
}
```
- `MapView` + `Marker` 로 현재 위치와 주변 가이드 위치 표시.
- `onLocationChange` 가 있으면 지도 탭으로 위치 선택 가능.
- `expo-location` 으로 현재 GPS 위치 읽기. 권한 거부 시 서울 시청 좌표(37.5665, 126.9780) 기본값 사용. 권한 요청 거부 시 수동 입력 안내 Alert 표시.

### 3. `mobile/src/components/RequestForm.tsx`

도움 요청 생성 폼:
```typescript
interface RequestFormProps {
  initialLat: number;
  initialLng: number;
  onSubmit: (body: CreateRequestBody) => void;
  isLoading: boolean;
}
```
- 요청 유형 (GUIDE / TRANSLATION / FOOD / EMERGENCY) 선택.
- 설명 텍스트 입력.
- 시작 시각 (DateTimePicker 또는 `+30분 / +1시간` 빠른 선택).
- 소요 시간 (분 단위 슬라이더, 30~240).
- 제안 금액 (KRW 정수, `TextInput keyboardType="numeric"`).
- "요청하기" 버튼 → `useCreateRequest().mutate()`.

### 4. `mobile/src/components/GuideOfferCard.tsx`

```typescript
interface GuideOfferCardProps {
  offer: MatchOfferResponse;
  onConfirm: (guideId: number) => void;
  isConfirming: boolean;
}
```
- 가이드 이름, 평점 (별점 표시), 메시지, 도착 예상 시간 표시.
- "이 가이드로 확정" 버튼 → `useConfirmGuide().mutate()`.

### 5. `mobile/src/screens/ChatScreen.tsx`

최소 구현 (채팅 상세 구현은 step 5):
- 현재 활성 요청의 채팅방 ID 를 `useChatRoom(requestId)` 로 가져온다.
- 채팅방이 없으면 "매칭 확정 후 채팅이 열립니다" 안내.
- 채팅방이 있으면 step 5 에서 구현할 `ChatScreen` 의 플레이스홀더.

### 6. `mobile/src/components/ReviewForm.tsx`

```typescript
interface ReviewFormProps {
  requestId: number;
  guideId: number;
  onSubmit: () => void;
}
```
- 별점 (1~5) 선택.
- 코멘트 텍스트 입력 (선택).
- "리뷰 제출" 버튼 → `useCreateReview().mutate()`.
- 실제 중복 리뷰 여부 사전 조회는 현재 백엔드 API에 없으므로 step 6 의 `ReviewScreen` 에서 서버 에러와 제출 성공 state 로 처리한다.

### 7. 결제/리뷰 이동 버튼

`TravelerScreen` 내 MATCHED 상태일 때:
- 확정된 오퍼에서 `guideId` 를 확인한다.
- "결제하기 (Mock)" 버튼 → step 6 에서 구현할 `PaymentScreen` 으로 이동할 수 있도록 navigation 의 자리만 만든다.
- 실제 결제 의도 생성, 캡처, 리뷰 제출은 step 6 에서 완성한다.

### 8. 테스트

`mobile/src/__tests__/RequestForm.test.tsx`:
- 필수 필드 미입력 시 버튼이 비활성화된다.
- 제출 시 `onSubmit` 이 올바른 형태의 body 로 호출된다.

`mobile/src/__tests__/GuideOfferCard.test.tsx`:
- "이 가이드로 확정" 버튼 클릭 시 `onConfirm(offer.guideId)` 가 호출된다.
- `isConfirming: true` 일 때 버튼이 비활성화된다.

## Acceptance Criteria

```bash
cd mobile && npm test     # RequestForm, GuideOfferCard 테스트 통과
cd mobile && npm run lint # 에러 0
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `TravelerScreen` 이 `apiFetch` 를 직접 호출하지 않고 훅만 사용하는가?
   - `LocationMap` 이 권한 거부 시 크래시 없이 기본 위치로 폴백하는가?
   - `TravelerScreen` 이 결제/리뷰 자체 로직을 직접 구현하지 않고 step 6 화면으로 이동할 수 있는 구조인가?
3. `phases/1-mobile-app/index.json` step 3 업데이트.

## 금지사항

- Google Maps / Mapbox API 키가 필요한 지도 라이브러리를 사용하지 마라. 이유: API 키 관리 비용 및 harness blocked 유발. `react-native-maps` + OSM 타일만 허용 (ADR-008 정신 계승).
- `expo-location` 권한 없이 GPS 접근하지 마라. 이유: 런타임 크래시. 반드시 `requestForegroundPermissionsAsync()` 로 권한 요청 후 접근.
- 결제 금액을 `Double` 타입으로 처리하지 마라. 이유: 부동소수점 오차. API 계약대로 KRW 정수.
- 기존 `backend/` 및 `web/` 코드를 수정하지 마라.
