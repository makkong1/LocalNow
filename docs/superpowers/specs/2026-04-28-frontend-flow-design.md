# Frontend Flow 개선 설계

**날짜**: 2026-04-28  
**대상**: `mobile/` (React Native / Expo)  
**브랜치**: `feat-3-concurrency-fix` 기반

---

## 배경 및 목표

분석 결과 발견된 문제:

1. **버그**: `useRealtime.ts:68` 쿼리 키 불일치로 가이드 실시간 요청 업데이트 불가
2. **Dead tab**: Chat 탭이 static placeholder — 사용자가 채팅방 접근 불가
3. **상태 손실**: `GuideScreen.acceptedIds` 로컬 상태가 탭 이동 시 리셋됨
4. **상태 머신 누락**: `MATCHED → IN_PROGRESS` 전환 버튼 없음
5. **UX 피드백 부재**: 가이드 확정 후 무반응, 채팅 버튼 disabled 이유 불명
6. **기타**: `navigation.replace()`, 컴포넌트 이름 충돌, 영문 상태 레이블

목표: 위 문제를 **접근 방식 B** (TravelerScreen 패턴을 GuideScreen에 적용 + ChatListScreen 신설) 로 해결한다.

---

## 1. Navigation 구조

변경 없는 부분: `RootNavigator`, `AuthNavigator`, Stack 스크린 (`ChatRoom`, `Payment`, `Review`).

`AppNavigator.tsx` 에서 `RecentChatPlaceholder` 를 `ChatListScreen` 으로 교체한다.

```
AppNavigator (Stack)
├── MainTabs (Bottom Tab)
│   ├── Traveler   — TravelerScreen (기존)
│   ├── Guide      — GuideScreen (리팩터)
│   └── Chat       — ChatListScreen (신설)
├── ChatRoom       — ChatScreen (기존)
├── Payment        — PaymentScreen (기존, navigate fix)
└── Review         — ReviewScreen (기존)
```

타입 변경 없음: `AppTabParamList.Chat: undefined`, `AppStackParamList` 동일.

---

## 2. GuideScreen 리팩터

### 2-1. 새 훅: `useGuideActiveOffer`

```ts
// mobile/src/hooks/useGuide.ts 에 추가
// GET /offers/mine
// 가이드 본인의 활성 offer (status: PENDING | CONFIRMED | IN_PROGRESS) 를 반환한다.
// 없으면 data === null.
function useGuideActiveOffer(): UseQueryResult<GuideOfferResponse | null>
```

쿼리 키: `['offers', 'mine']`

`GuideOfferResponse` 에 `requestId` 필드가 포함되어야 한다 (채팅방 조회, 서비스 시작 API 호출에 사용).

가이드가 복수 요청을 수락한 경우 가장 최신 활성 offer 1건을 반환한다. (백엔드 `GET /offers/mine` 는 단건 반환 계약으로 설계한다.)

### 2-2. 새 뮤테이션: `useStartService`

```ts
// mobile/src/hooks/useMatches.ts 에 추가
// POST /requests/{requestId}/start
// MATCHED → IN_PROGRESS 전환. 가이드만 호출 가능.
function useStartService(): UseMutationResult<void, Error, { requestId: number }>
```

성공 시: `queryClient.invalidateQueries({ queryKey: ['offers', 'mine'] })`

### 2-3. GuideScreen 렌더 트리

```
GuideScreen
│
├── [isOnDuty === false]
│   └── OnDutyView — OnDutyToggle 만 표시
│
├── [isOnDuty === true, offer === null]
│   └── OpenRequestsView
│       ├── OnDutyToggle
│       ├── useOpenRequests() 목록
│       └── RequestCard (수락 버튼) → useAcceptRequest() → invalidate ['offers', 'mine']
│
├── [offer.status === 'PENDING']
│   └── AcceptedView
│       ├── "수락 완료. 여행자가 확정하면 알림이 옵니다." 안내
│       └── offer 카드 (읽기 전용)
│
├── [offer.status === 'CONFIRMED']
│   └── MatchedView
│       ├── offer 카드
│       ├── 채팅하기 버튼 → useChatRoom(requestId) → ChatRoom 이동
│       └── "서비스 시작" 버튼 → useStartService({ requestId })
│
└── [offer.status === 'IN_PROGRESS']
    └── InProgressView
        ├── offer 카드 (IN_PROGRESS 상태 표시)
        └── 채팅하기 버튼 → ChatRoom 이동
```

**제거**: `acceptedIds` 로컬 state, `acceptingId` 로컬 state, `confirmedRequestId` 로컬 state, GuideScreen 내 직접 STOMP 구독 (`useEffect` + `stompClient.subscribe`).

### 2-4. useRealtime 수정

| 위치 | 현재 | 변경 |
|------|------|------|
| `useRealtime.ts:68` | `queryKey: ['openRequests']` | `queryKey: ['requests', 'open']` |
| `useRealtime.ts` (GUIDE 구독 블록) | `MATCH_CONFIRMED` → `invalidateQueries(['myRequests'])` | + `invalidateQueries(['offers', 'mine'])` 추가 |

---

## 3. ChatListScreen (신설)

파일: `mobile/src/screens/ChatListScreen.tsx`

### 3-1. 새 훅: `useChatRooms`

```ts
// mobile/src/hooks/useChat.ts 에 추가
// GET /chat/rooms — 내가 참여 중인 채팅방 목록
function useChatRooms(): UseQueryResult<ChatRoomResponse[]>
```

쿼리 키: `['chatRooms']`

### 3-2. 타입 추가 (`types/api.ts`)

```ts
interface ChatRoomResponse {
  roomId: number;
  requestId: number;
  requestType: string;      // GUIDE | TRANSLATION | FOOD | EMERGENCY
  partnerName: string;      // 상대방 표시 이름
  lastMessagePreview: string | null;
  lastMessageAt: string | null;  // ISO 8601
}
```

### 3-3. 화면 구조

```
ChatListScreen
├── isLoading → ActivityIndicator
├── rooms.length === 0 → "확정된 매칭이 없습니다" empty state
└── rooms.length > 0 → FlatList<ChatRoomResponse>
    └── ChatRoomRow
        ├── requestType 뱃지 + partnerName
        ├── lastMessagePreview (없으면 "대화를 시작해보세요")
        ├── lastMessageAt (상대적 시간, 없으면 생략)
        └── onPress → navigation.navigate('ChatRoom', { roomId, requestId })
```

### 3-4. useRealtime 확장

`CHAT_MESSAGE` 이벤트 처리:
- 기존: `invalidateQueries(['messages', roomId])`
- 추가: `invalidateQueries(['chatRooms'])` — 목록의 lastMessagePreview 갱신

---

## 4. 버그 픽스

| ID | 파일 | 변경 |
|----|------|------|
| B1 | `mobile/src/hooks/useRealtime.ts:68` | `['openRequests']` → `['requests', 'open']` |
| B2 | `mobile/src/screens/PaymentScreen.tsx:43` | `navigation.replace('Review', ...)` → `navigation.navigate('Review', ...)` |

---

## 5. UX 폴리시

| ID | 파일 | 변경 |
|----|------|------|
| U1 | `TravelerScreen.tsx` | 인라인 `RequestCard` → `TravelerRequestCard` rename |
| U2 | `TravelerScreen.tsx` | `confirmGuide.mutate()` `onSuccess` 콜백에 `Alert.alert('확정 완료', '가이드가 확정되었습니다.')` |
| U3 | `TravelerScreen.tsx` | `MatchedView` 채팅 버튼: `disabled={!room}` 유지, 버튼 텍스트를 `room ? '채팅하기' : '채팅방 생성 중...'` 으로 변경 |
| U4 | `TravelerScreen.tsx`, `GuideScreen.tsx` | `StatusBadge` 한국어 레이블 맵: `OPEN→대기중`, `MATCHED→확정됨`, `IN_PROGRESS→진행중`, `COMPLETED→완료`, `CANCELLED→취소` |
| U5 | `GuideScreen.tsx` | `OpenRequestsView` 의 `handleAccept` `onSuccess` 콜백에서 `Alert.alert('수락 완료', '여행자가 확정하면 알림이 옵니다.')` — AcceptedView 마운트가 아닌 수락 직후 1회만 발화 |

---

## 6. 스코프 밖 (이 설계에서 제외)

- `oauth-redirect.ts` OAuth2 귀환 플로우 — 별도 phase
- `PaymentScreen` auto-create intent 로직 — Mock PG 특성상 현상 유지
- `ReviewScreen` — 변경 불필요
- 백엔드 신규 엔드포인트 (`GET /offers/mine`, `POST /requests/{id}/start`, `GET /chat/rooms`) — 이미 존재하거나 백엔드 팀과 협의 필요. 모바일 구현 시 Mock 응답으로 대체 후 연동.

---

## 7. Acceptance Criteria

```bash
cd mobile && npm run lint    # ESLint 에러 없음
cd mobile && npm test        # Jest 통과
```

체크리스트:
- [ ] Chat 탭 진입 시 채팅방 목록이 표시된다 (빈 경우 empty state)
- [ ] 가이드가 요청 수락 → 탭 이동 → 돌아와도 AcceptedView 가 유지된다
- [ ] 여행자가 가이드 확정 시 Alert 표시된다
- [ ] 가이드가 MATCHED 상태에서 "서비스 시작" 버튼 노출, 누르면 InProgressView 로 전환된다
- [ ] 새 요청 STOMP 이벤트 수신 시 가이드 목록이 자동 갱신된다 (B1 fix 검증)
- [ ] PaymentScreen 에서 결제 완료 후 뒤로 가기 가능하다 (B2 fix 검증)
- [ ] StatusBadge 가 한국어로 표시된다
