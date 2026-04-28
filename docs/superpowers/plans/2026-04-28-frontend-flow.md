# Mobile Frontend Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 앱의 실시간 버그 수정, GuideScreen 상태 머신 서브뷰 분리, ChatListScreen 신설로 여행자·가이드 플로우를 완성한다.

**Architecture:** TravelerScreen의 상태별 서브뷰 패턴을 GuideScreen에 적용한다. GuideScreen의 acceptedIds 로컬 상태를 서버 fetch(`useGuideActiveOffer`)로 대체해 탭 이동 시 상태 손실을 제거한다. Chat 탭은 `/chat/rooms` 기반 ChatListScreen으로 교체한다.

**Tech Stack:** React Native 0.76 (Expo SDK 52), TanStack Query v5, React Navigation v6, `@testing-library/react-native`, Jest

---

## File Map

**신규 생성:**
- `mobile/src/screens/ChatListScreen.tsx`
- `mobile/src/__tests__/ChatListScreen.test.tsx`
- `mobile/src/__tests__/GuideScreen.test.tsx`

**수정:**
- `mobile/src/types/api.ts` — `GuideActiveOfferResponse`, `ChatRoomSummaryResponse` 추가
- `mobile/src/hooks/useRealtime.ts` — 쿼리 키 버그 fix, chatRooms·offers/mine invalidation 추가
- `mobile/src/hooks/useGuide.ts` — `useGuideActiveOffer` 추가
- `mobile/src/hooks/useMatches.ts` — `useStartService` 추가, `useAcceptRequest.onSuccess` 확장
- `mobile/src/hooks/useChat.ts` — `useChatRooms` 추가
- `mobile/src/components/StatusBadge.tsx` — 한국어 레이블 맵 추가
- `mobile/src/screens/TravelerScreen.tsx` — U1 rename, U2 Alert, U3 채팅 버튼 텍스트, 인라인 StatusBadge 제거
- `mobile/src/screens/GuideScreen.tsx` — 전면 리팩터 (상태별 서브뷰)
- `mobile/src/screens/PaymentScreen.tsx` — `replace` → `navigate` fix
- `mobile/src/navigation/AppNavigator.tsx` — ChatListScreen 연결
- `mobile/src/__tests__/PaymentScreen.test.tsx` — navigate 검증으로 업데이트

---

## Task 1: 버그 픽스 + 타입 기반 작업

**Files:**
- Modify: `mobile/src/hooks/useRealtime.ts`
- Modify: `mobile/src/screens/PaymentScreen.tsx`
- Modify: `mobile/src/__tests__/PaymentScreen.test.tsx`
- Modify: `mobile/src/types/api.ts`

- [ ] **Step 1: useRealtime.ts 쿼리 키 버그 수정 (B1)**

`mobile/src/hooks/useRealtime.ts` 의 68번째 줄 (GUIDE 구독 블록의 `NEW_REQUEST` 처리):

```ts
// 변경 전
queryClient.invalidateQueries({ queryKey: ['openRequests'] });

// 변경 후
queryClient.invalidateQueries({ queryKey: ['requests', 'open'] });
```

- [ ] **Step 2: PaymentScreen.tsx replace → navigate 수정 (B2)**

`mobile/src/screens/PaymentScreen.tsx` 의 `handleCapture` 함수:

```ts
// 변경 전
onSuccess: () => navigation.replace('Review', { requestId, guideId }),

// 변경 후
onSuccess: () => navigation.navigate('Review', { requestId, guideId }),
```

- [ ] **Step 3: PaymentScreen 테스트를 navigate 검증으로 업데이트**

`mobile/src/__tests__/PaymentScreen.test.tsx` 전체 파일을 아래로 교체한다:

```tsx
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import PaymentScreen from '../screens/PaymentScreen';
import type { AppStackParamList } from '../navigation/AppNavigator';
import type { PaymentIntentResponse } from '../types/api';

const mockMutate = jest.fn();
const mockNavigate = jest.fn();

const mockRequestsPage = {
  success: true,
  data: {
    items: [
      {
        id: 1,
        travelerId: 10,
        requestType: 'GUIDE' as const,
        lat: 37.5,
        lng: 127.0,
        description: 'test',
        startAt: '2026-01-01T00:00:00Z',
        durationMin: 60,
        budgetKrw: 50000,
        status: 'MATCHED' as const,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
  },
};

const baseIntent: PaymentIntentResponse = {
  id: 1,
  requestId: 1,
  amountKrw: 50000,
  platformFeeKrw: 7500,
  guidePayout: 42500,
  status: 'AUTHORIZED',
  createdAt: '2026-01-01T00:00:00Z',
};

jest.mock('../hooks/useRequests', () => ({
  useMyRequests: () => mockRequestsPage,
}));

jest.mock('../hooks/usePayment', () => ({
  usePaymentIntent: jest.fn(),
  useCreatePaymentIntent: () => ({ mutate: jest.fn(), isPending: false, data: undefined }),
  useCapturePayment: () => ({ mutate: mockMutate, isPending: false, isError: false }),
}));

const { usePaymentIntent } = jest.requireMock('../hooks/usePayment') as {
  usePaymentIntent: jest.Mock;
};

const route: StackScreenProps<AppStackParamList, 'Payment'>['route'] = {
  key: 'Payment',
  name: 'Payment',
  params: { requestId: 1, guideId: 2 },
};

const navigation = {
  replace: jest.fn(),
  navigate: mockNavigate,
} as unknown as StackScreenProps<AppStackParamList, 'Payment'>['navigation'];

describe('PaymentScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays amount breakdown when payment intent is loaded', async () => {
    usePaymentIntent.mockReturnValue({ data: baseIntent, isLoading: false });
    const { getByTestId } = render(<PaymentScreen route={route} navigation={navigation} />);
    await waitFor(() => {
      expect(getByTestId('amount-krw').props.children).toContain('50,000');
    });
    expect(getByTestId('platform-fee-krw').props.children).toContain('7,500');
    expect(getByTestId('guide-payout').props.children).toContain('42,500');
  });

  it('calls useCapturePayment mutate when capture button is pressed', async () => {
    usePaymentIntent.mockReturnValue({ data: baseIntent, isLoading: false });
    const { getByTestId } = render(<PaymentScreen route={route} navigation={navigation} />);
    await waitFor(() => expect(getByTestId('capture-button')).toBeTruthy());
    await act(async () => { fireEvent.press(getByTestId('capture-button')); });
    expect(mockMutate).toHaveBeenCalledWith(
      { requestId: 1 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('navigates to Review (not replace) on capture success', async () => {
    usePaymentIntent.mockReturnValue({ data: baseIntent, isLoading: false });
    let capturedOnSuccess: (() => void) | undefined;
    mockMutate.mockImplementation((_: unknown, opts: { onSuccess?: () => void }) => {
      capturedOnSuccess = opts?.onSuccess;
    });
    const { getByTestId } = render(<PaymentScreen route={route} navigation={navigation} />);
    await waitFor(() => expect(getByTestId('capture-button')).toBeTruthy());
    await act(async () => { fireEvent.press(getByTestId('capture-button')); });
    act(() => { capturedOnSuccess?.(); });
    expect(mockNavigate).toHaveBeenCalledWith('Review', { requestId: 1, guideId: 2 });
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('disables capture button when already CAPTURED', async () => {
    usePaymentIntent.mockReturnValue({
      data: { ...baseIntent, status: 'CAPTURED' },
      isLoading: false,
    });
    const { getByTestId } = render(<PaymentScreen route={route} navigation={navigation} />);
    await waitFor(() => {
      const btn = getByTestId('capture-button');
      expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBe(true);
    });
  });
});
```

- [ ] **Step 4: api.ts 에 새 타입 추가**

`mobile/src/types/api.ts` 파일 맨 끝 (`NotificationPayload` 아래)에 추가:

```ts
// Guide active offer (GET /offers/mine)
export interface GuideActiveOfferResponse {
  offerId: number;
  offerStatus: 'PENDING' | 'CONFIRMED';
  requestId: number;
  requestType: RequestType;
  requestStatus: HelpRequestStatus;
  budgetKrw: number;
  durationMin: number;
  description: string;
  travelerId: number;
  travelerName: string;
}

// Chat room list item (GET /chat/rooms)
export interface ChatRoomSummaryResponse {
  roomId: number;
  requestId: number;
  requestType: RequestType;
  partnerName: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
}
```

- [ ] **Step 5: 테스트 실행 확인**

```bash
cd mobile && npm run lint && npm test -- --testPathPattern="PaymentScreen"
```

예상 결과: 4개 테스트 통과, lint 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add mobile/src/hooks/useRealtime.ts \
        mobile/src/screens/PaymentScreen.tsx \
        mobile/src/__tests__/PaymentScreen.test.tsx \
        mobile/src/types/api.ts
git commit -m "fix(mobile): query key mismatch, payment replace→navigate, add guide/chat types"
```

---

## Task 2: StatusBadge 한국어 + TravelerScreen 폴리시

**Files:**
- Modify: `mobile/src/components/StatusBadge.tsx`
- Modify: `mobile/src/screens/TravelerScreen.tsx`

- [ ] **Step 1: StatusBadge.tsx 한국어 레이블 맵 추가**

`mobile/src/components/StatusBadge.tsx` 의 `STATUS_COLOR` 아래에 레이블 맵을 추가하고, `{status}` 텍스트를 레이블로 교체한다:

```tsx
const STATUS_LABEL: Record<string, string> = {
  OPEN: '대기중',
  MATCHED: '확정됨',
  CONFIRMED: '확정됨',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  CANCELLED: '취소',
  REJECTED: '거절됨',
  PENDING: '대기중',
};
```

`StatusBadge` 컴포넌트의 `<Text>` 렌더링을:

```tsx
// 변경 전
<Text style={[styles.label, size === 'md' && styles.labelMd, { color }]}>{status}</Text>

// 변경 후
<Text style={[styles.label, size === 'md' && styles.labelMd, { color }]}>
  {STATUS_LABEL[status] ?? status}
</Text>
```

- [ ] **Step 2: TravelerScreen — 인라인 StatusBadge 제거 및 공유 컴포넌트로 교체**

`mobile/src/screens/TravelerScreen.tsx` 에서:

1. 파일 상단 import 목록에 추가:
```tsx
import StatusBadge from '../components/StatusBadge';
```

2. `TravelerScreen.tsx` 내의 인라인 `StatusBadge` 함수 전체 (35~48번째 줄) 삭제:
```tsx
// 이 함수 전체 삭제
function StatusBadge({ status }: { status: HelpRequestResponse['status'] }) {
  const colors: Record<string, string> = { ... };
  return ( ... );
}
```

3. `styles` 객체에서 인라인 StatusBadge 전용 스타일 3개 삭제 (이제 미사용):
```ts
// 삭제
badge: { ... },
badgeDot: { ... },
badgeText: { ... },
```

- [ ] **Step 3: TravelerScreen — 인라인 RequestCard 를 TravelerRequestCard 로 rename (U1)**

`mobile/src/screens/TravelerScreen.tsx` 의 인라인 `RequestCard` 함수명을 `TravelerRequestCard` 로 변경하고, 사용 위치 3곳도 교체한다:

```tsx
// 변경 전
function RequestCard({ request }: { request: HelpRequestResponse }) { ... }

// 변경 후
function TravelerRequestCard({ request }: { request: HelpRequestResponse }) { ... }
```

사용 위치 (`OpenView`, `MatchedView`, `CompletedView` 안) 3곳:
```tsx
// 모두 교체
<TravelerRequestCard request={request} />
```

- [ ] **Step 4: TravelerScreen — confirmGuide Alert 추가 (U2)**

`OpenView` 컴포넌트의 `handleConfirm` 함수:

```tsx
// 변경 전
function handleConfirm(guideId: number) {
  confirmGuide.mutate({ requestId: request.id, guideId });
}

// 변경 후
function handleConfirm(guideId: number) {
  confirmGuide.mutate(
    { requestId: request.id, guideId },
    {
      onSuccess: () => {
        Alert.alert('확정 완료', '가이드가 확정되었습니다.');
      },
    },
  );
}
```

`Alert` 를 import 목록에 추가 (기존 `React Native` import에):
```tsx
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Modal, ActivityIndicator, Alert,
} from 'react-native';
```

- [ ] **Step 5: TravelerScreen — MatchedView 채팅 버튼 텍스트 동적화 (U3)**

`MatchedView` 의 채팅 버튼 `<Text>`:

```tsx
// 변경 전
<Text style={styles.secondaryButtonText}>채팅하기</Text>

// 변경 후
<Text style={styles.secondaryButtonText}>
  {room ? '채팅하기' : '채팅방 생성 중...'}
</Text>
```

- [ ] **Step 6: 테스트 실행 확인**

```bash
cd mobile && npm run lint && npm test
```

예상 결과: 모든 테스트 통과, lint 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add mobile/src/components/StatusBadge.tsx \
        mobile/src/screens/TravelerScreen.tsx
git commit -m "feat(mobile): StatusBadge 한국어 레이블, TravelerScreen UX 폴리시"
```

---

## Task 3: 새 훅 + useRealtime 확장

**Files:**
- Modify: `mobile/src/hooks/useGuide.ts`
- Modify: `mobile/src/hooks/useMatches.ts`
- Modify: `mobile/src/hooks/useChat.ts`
- Modify: `mobile/src/hooks/useRealtime.ts`

- [ ] **Step 1: useGuide.ts 에 useGuideActiveOffer 추가**

`mobile/src/hooks/useGuide.ts` 전체 파일을 아래로 교체:

```ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { GuideActiveOfferResponse } from '../types/api';

export function useSetDuty() {
  return useMutation({
    mutationFn: async ({
      onDuty,
      lat,
      lng,
    }: {
      onDuty: boolean;
      lat?: number;
      lng?: number;
    }) => {
      const res = await apiFetch<void>('/guide/duty', {
        method: 'POST',
        body: { onDuty, lat, lng },
      });
      if (!res.success) throw res.error;
    },
  });
}

export function useGuideActiveOffer() {
  return useQuery<GuideActiveOfferResponse | null>({
    queryKey: ['offers', 'mine'],
    queryFn: async () => {
      const res = await apiFetch<GuideActiveOfferResponse>('/offers/mine');
      if (!res.success) {
        if (res.error?.code === 'NOT_FOUND') return null;
        throw res.error;
      }
      return res.data;
    },
  });
}
```

- [ ] **Step 2: useMatches.ts 에 useStartService 추가, useAcceptRequest.onSuccess 확장**

`mobile/src/hooks/useMatches.ts` 전체 파일을 아래로 교체:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { MatchOfferResponse } from '../types/api';

export function useOffers(requestId: number) {
  return useQuery({
    queryKey: ['offers', requestId],
    queryFn: async () => {
      const res = await apiFetch<MatchOfferResponse[]>(`/requests/${requestId}/offers`);
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, message }: { requestId: number; message?: string }) => {
      const res = await apiFetch<MatchOfferResponse>(`/requests/${requestId}/accept`, {
        method: 'POST',
        body: { message },
      });
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
    onSuccess: (_, { requestId }) => {
      qc.invalidateQueries({ queryKey: ['offers', requestId] });
      qc.invalidateQueries({ queryKey: ['requests', 'open'] });
      qc.invalidateQueries({ queryKey: ['offers', 'mine'] });
    },
  });
}

export function useConfirmGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, guideId }: { requestId: number; guideId: number }) => {
      const res = await apiFetch<MatchOfferResponse>(`/requests/${requestId}/confirm`, {
        method: 'POST',
        body: { guideId },
      });
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
    onSuccess: (_, { requestId }) => {
      qc.invalidateQueries({ queryKey: ['offers', requestId] });
      qc.invalidateQueries({ queryKey: ['requests', 'me'] });
    },
  });
}

export function useStartService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId }: { requestId: number }) => {
      const res = await apiFetch<void>(`/requests/${requestId}/start`, { method: 'POST' });
      if (!res.success) throw res.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers', 'mine'] });
    },
  });
}
```

- [ ] **Step 3: useChat.ts 에 useChatRooms 추가**

`mobile/src/hooks/useChat.ts` 전체 파일을 아래로 교체:

```ts
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { ChatRoomResponse, ChatMessageResponse, ChatRoomSummaryResponse } from '../types/api';

export function useChatRoom(requestId: number) {
  return useQuery({
    queryKey: ['chatRoom', requestId],
    queryFn: async () => {
      const res = await apiFetch<ChatRoomResponse>(`/requests/${requestId}/room`);
      if (!res.success) {
        if (res.error?.code === 'REQUEST_NOT_FOUND') return null;
        throw res.error;
      }
      return res.data;
    },
  });
}

export function useMessages(roomId: number) {
  return useQuery({
    queryKey: ['messages', roomId],
    queryFn: async () => {
      const res = await apiFetch<ChatMessageResponse[]>(`/rooms/${roomId}/messages`);
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
  });
}

export function useChatRooms() {
  return useQuery<ChatRoomSummaryResponse[]>({
    queryKey: ['chatRooms'],
    queryFn: async () => {
      const res = await apiFetch<ChatRoomSummaryResponse[]>('/chat/rooms');
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
  });
}
```

- [ ] **Step 4: useRealtime.ts MATCH_CONFIRMED + CHAT_MESSAGE 핸들러 확장**

`mobile/src/hooks/useRealtime.ts` 의 GUIDE 구독 블록 (`role !== 'GUIDE'` 체크 이후):

```ts
// 변경 전
} else if (event.type === 'MATCH_CONFIRMED') {
  Alert.alert('매칭 확정', '요청이 확정되었습니다.');
  queryClient.invalidateQueries({ queryKey: ['myRequests'] });
}

// 변경 후
} else if (event.type === 'MATCH_CONFIRMED') {
  Alert.alert('매칭 확정', '요청이 확정되었습니다.');
  queryClient.invalidateQueries({ queryKey: ['myRequests'] });
  queryClient.invalidateQueries({ queryKey: ['offers', 'mine'] });
}
```

같은 파일의 CHAT_MESSAGE 핸들러 (`event.type === 'CHAT_MESSAGE'`):

```ts
// 변경 전
if (event.type === 'CHAT_MESSAGE') {
  queryClient.invalidateQueries({ queryKey: ['messages', event.roomId] });
}

// 변경 후
if (event.type === 'CHAT_MESSAGE') {
  queryClient.invalidateQueries({ queryKey: ['messages', event.roomId] });
  queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
}
```

- [ ] **Step 5: 테스트 실행 확인**

```bash
cd mobile && npm run lint && npm test
```

예상 결과: 모든 테스트 통과, lint 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add mobile/src/hooks/useGuide.ts \
        mobile/src/hooks/useMatches.ts \
        mobile/src/hooks/useChat.ts \
        mobile/src/hooks/useRealtime.ts
git commit -m "feat(mobile): useGuideActiveOffer, useStartService, useChatRooms, useRealtime 확장"
```

---

## Task 4: GuideScreen 리팩터

**Files:**
- Modify: `mobile/src/screens/GuideScreen.tsx`
- Create: `mobile/src/__tests__/GuideScreen.test.tsx`

- [ ] **Step 1: GuideScreen.test.tsx 작성 (failing)**

`mobile/src/__tests__/GuideScreen.test.tsx` 파일 생성:

```tsx
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import GuideScreen from '../screens/GuideScreen';
import type { GuideActiveOfferResponse } from '../types/api';

const mockNavigate = jest.fn();
const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockStartMutate = jest.fn();
const mockAcceptMutate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../hooks/useGuide', () => ({
  useSetDuty: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useGuideActiveOffer: jest.fn(),
}));

jest.mock('../hooks/useRequests', () => ({
  useOpenRequests: () => ({ data: null, isLoading: false }),
}));

jest.mock('../hooks/useMatches', () => ({
  useAcceptRequest: () => ({ mutate: mockAcceptMutate, isPending: false }),
  useStartService: () => ({ mutate: mockStartMutate, isPending: false }),
}));

jest.mock('../hooks/useChat', () => ({
  useChatRoom: () => ({ data: null }),
}));

jest.mock('../components/OnDutyToggle', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return function MockOnDutyToggle({
    onToggle,
    isOnDuty,
  }: {
    onToggle: (v: boolean) => void;
    isOnDuty: boolean;
  }) {
    return (
      <TouchableOpacity testID="duty-toggle" onPress={() => onToggle(!isOnDuty)}>
        <Text>{isOnDuty ? 'ON' : 'OFF'}</Text>
      </TouchableOpacity>
    );
  };
});

jest.mock('../components/RequestCard', () => {
  const { View, Text } = require('react-native');
  return function MockRequestCard() {
    return (
      <View>
        <Text>RequestCard</Text>
      </View>
    );
  };
});

jest.mock('../components/StatusBadge', () => {
  const { Text } = require('react-native');
  return function MockStatusBadge({ status }: { status: string }) {
    return <Text>{status}</Text>;
  };
});

const { useGuideActiveOffer } = jest.requireMock('../hooks/useGuide') as {
  useGuideActiveOffer: jest.Mock;
};

const baseOffer: GuideActiveOfferResponse = {
  offerId: 1,
  offerStatus: 'PENDING',
  requestId: 10,
  requestType: 'GUIDE',
  requestStatus: 'OPEN',
  budgetKrw: 30000,
  durationMin: 60,
  description: '관광 가이드 요청',
  travelerId: 20,
  travelerName: '여행자',
};

describe('GuideScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGuideActiveOffer.mockReturnValue({ data: null, isLoading: false });
  });

  it('off-duty 상태에서는 duty toggle만 표시한다', () => {
    const { getByTestId, queryByText } = render(<GuideScreen />);
    expect(getByTestId('duty-toggle')).toBeTruthy();
    expect(queryByText('주변 도움 요청')).toBeNull();
  });

  it('on-duty + 활성 오퍼 없을 때 주변 요청 목록을 표시한다', async () => {
    const { getByTestId, getByText } = render(<GuideScreen />);
    await act(async () => { fireEvent.press(getByTestId('duty-toggle')); });
    expect(getByText('주변 도움 요청')).toBeTruthy();
  });

  it('offer.offerStatus === PENDING 일 때 AcceptedView를 표시한다', async () => {
    useGuideActiveOffer.mockReturnValue({ data: baseOffer, isLoading: false });
    const { getByTestId, getByText } = render(<GuideScreen />);
    await act(async () => { fireEvent.press(getByTestId('duty-toggle')); });
    expect(getByText('수락 완료. 여행자가 확정하면 알림이 옵니다.')).toBeTruthy();
  });

  it('offer CONFIRMED + request MATCHED 일 때 서비스 시작 버튼을 표시한다', async () => {
    useGuideActiveOffer.mockReturnValue({
      data: { ...baseOffer, offerStatus: 'CONFIRMED', requestStatus: 'MATCHED' },
      isLoading: false,
    });
    const { getByTestId } = render(<GuideScreen />);
    await act(async () => { fireEvent.press(getByTestId('duty-toggle')); });
    expect(getByTestId('start-service-button')).toBeTruthy();
  });

  it('서비스 시작 버튼 클릭 시 useStartService.mutate를 호출한다', async () => {
    useGuideActiveOffer.mockReturnValue({
      data: { ...baseOffer, offerStatus: 'CONFIRMED', requestStatus: 'MATCHED' },
      isLoading: false,
    });
    const { getByTestId } = render(<GuideScreen />);
    await act(async () => { fireEvent.press(getByTestId('duty-toggle')); });
    fireEvent.press(getByTestId('start-service-button'));
    expect(mockStartMutate).toHaveBeenCalledWith({ requestId: 10 });
  });

  it('offer CONFIRMED + request IN_PROGRESS 일 때 InProgressView를 표시한다', async () => {
    useGuideActiveOffer.mockReturnValue({
      data: { ...baseOffer, offerStatus: 'CONFIRMED', requestStatus: 'IN_PROGRESS' },
      isLoading: false,
    });
    const { getByTestId } = render(<GuideScreen />);
    await act(async () => { fireEvent.press(getByTestId('duty-toggle')); });
    expect(getByTestId('guide-go-to-chat-button')).toBeTruthy();
    expect(() => getByTestId('start-service-button')).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd mobile && npm test -- --testPathPattern="GuideScreen"
```

예상 결과: FAIL (GuideScreen이 아직 리팩터 전이므로)

- [ ] **Step 3: GuideScreen.tsx 전면 리팩터**

`mobile/src/screens/GuideScreen.tsx` 전체 파일을 아래로 교체:

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useOpenRequests } from '../hooks/useRequests';
import { useAcceptRequest, useStartService } from '../hooks/useMatches';
import { useChatRoom } from '../hooks/useChat';
import { useSetDuty, useGuideActiveOffer } from '../hooks/useGuide';
import OnDutyToggle from '../components/OnDutyToggle';
import RequestCard from '../components/RequestCard';
import StatusBadge from '../components/StatusBadge';
import type { GuideActiveOfferResponse } from '../types/api';
import type { AppStackParamList } from '../navigation/AppNavigator';

function OnDutyOffView({
  onToggle,
  isLoading,
}: {
  onToggle: (onDuty: boolean, location?: { lat: number; lng: number }) => void;
  isLoading: boolean;
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OnDutyToggle isOnDuty={false} onToggle={onToggle} isLoading={isLoading} />
    </ScrollView>
  );
}

function OpenRequestsView({
  onToggle,
  isTogglerLoading,
}: {
  onToggle: (onDuty: boolean, location?: { lat: number; lng: number }) => void;
  isTogglerLoading: boolean;
}) {
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const acceptRequest = useAcceptRequest();
  const { data: requestsPage, isLoading } = useOpenRequests({
    enabled: true,
    refetchInterval: 10000,
  });
  const openRequests = requestsPage?.items ?? [];

  function handleAccept(requestId: number) {
    setAcceptingId(requestId);
    acceptRequest.mutate(
      { requestId },
      {
        onSuccess: () => {
          Alert.alert('수락 완료', '여행자가 확정하면 알림이 옵니다.');
          setAcceptingId(null);
        },
        onError: () => setAcceptingId(null),
      },
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OnDutyToggle isOnDuty={true} onToggle={onToggle} isLoading={isTogglerLoading} />
      <Text style={styles.sectionLabel}>주변 도움 요청</Text>
      {isLoading ? (
        <ActivityIndicator color="#f59e0b" style={styles.loader} />
      ) : openRequests.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>주변에 요청이 없습니다</Text>
        </View>
      ) : (
        openRequests.map((req) => (
          <RequestCard
            key={req.id}
            request={req}
            onAccept={handleAccept}
            isAccepting={acceptingId === req.id}
            isAccepted={false}
          />
        ))
      )}
    </ScrollView>
  );
}

function AcceptedView({ offer }: { offer: GuideActiveOfferResponse }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>{offer.requestType}</Text>
          <StatusBadge status="OPEN" />
        </View>
        <Text style={styles.cardDesc}>{offer.description}</Text>
        <Text style={styles.cardMeta}>
          {offer.budgetKrw.toLocaleString()}원 · {offer.durationMin}분
        </Text>
      </View>
      <View style={styles.hintBox}>
        <Text style={styles.hintText}>수락 완료. 여행자가 확정하면 알림이 옵니다.</Text>
      </View>
    </ScrollView>
  );
}

function MatchedView({ offer }: { offer: GuideActiveOfferResponse }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(offer.requestId);
  const startService = useStartService();

  function goToChat() {
    if (room) navigation.navigate('ChatRoom', { roomId: room.id, requestId: offer.requestId });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>{offer.requestType}</Text>
          <StatusBadge status="MATCHED" />
        </View>
        <Text style={styles.cardDesc}>{offer.description}</Text>
        <Text style={styles.cardMeta}>
          {offer.budgetKrw.toLocaleString()}원 · {offer.durationMin}분
        </Text>
      </View>
      <Text style={styles.sectionLabel}>다음 단계</Text>
      <TouchableOpacity
        testID="guide-go-to-chat-button"
        style={styles.secondaryButton}
        onPress={goToChat}
        disabled={!room}
      >
        <Text style={styles.secondaryButtonText}>
          {room ? '채팅하기' : '채팅방 생성 중...'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="start-service-button"
        style={[styles.primaryButton, startService.isPending && styles.primaryButtonDisabled]}
        onPress={() => startService.mutate({ requestId: offer.requestId })}
        disabled={startService.isPending}
      >
        <Text style={styles.primaryButtonText}>
          {startService.isPending ? '처리 중...' : '서비스 시작'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InProgressView({ offer }: { offer: GuideActiveOfferResponse }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(offer.requestId);

  function goToChat() {
    if (room) navigation.navigate('ChatRoom', { roomId: room.id, requestId: offer.requestId });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>{offer.requestType}</Text>
          <StatusBadge status="IN_PROGRESS" />
        </View>
        <Text style={styles.cardDesc}>{offer.description}</Text>
        <Text style={styles.cardMeta}>
          {offer.budgetKrw.toLocaleString()}원 · {offer.durationMin}분
        </Text>
      </View>
      <TouchableOpacity
        testID="guide-go-to-chat-button"
        style={[styles.primaryButton, !room && styles.primaryButtonDisabled]}
        onPress={goToChat}
        disabled={!room}
      >
        <Text style={styles.primaryButtonText}>
          {room ? '채팅하기' : '채팅방 생성 중...'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function GuideScreen() {
  const [isOnDuty, setIsOnDuty] = useState(false);
  const setDuty = useSetDuty();
  const { data: activeOffer, isLoading: offerLoading } = useGuideActiveOffer();

  async function handleToggle(onDuty: boolean, location?: { lat: number; lng: number }) {
    await setDuty.mutateAsync({ onDuty, lat: location?.lat, lng: location?.lng });
    setIsOnDuty(onDuty);
  }

  if (!isOnDuty) {
    return <OnDutyOffView onToggle={handleToggle} isLoading={setDuty.isPending} />;
  }

  if (offerLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </View>
    );
  }

  if (!activeOffer) {
    return <OpenRequestsView onToggle={handleToggle} isTogglerLoading={setDuty.isPending} />;
  }

  if (activeOffer.offerStatus === 'PENDING') {
    return <AcceptedView offer={activeOffer} />;
  }

  if (activeOffer.offerStatus === 'CONFIRMED' && activeOffer.requestStatus === 'MATCHED') {
    return <MatchedView offer={activeOffer} />;
  }

  if (activeOffer.offerStatus === 'CONFIRMED' && activeOffer.requestStatus === 'IN_PROGRESS') {
    return <InProgressView offer={activeOffer} />;
  }

  return <OpenRequestsView onToggle={handleToggle} isTogglerLoading={setDuty.isPending} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  sectionLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  loader: { marginVertical: 24 },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
  },
  emptyText: { color: '#525252', fontSize: 14 },
  card: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardDesc: { color: '#d4d4d4', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  cardMeta: { color: '#525252', fontSize: 11 },
  hintBox: {
    backgroundColor: '#1c1c1c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 16,
  },
  hintText: { color: '#a3a3a3', fontSize: 13, lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonDisabled: { backgroundColor: '#404040' },
  primaryButtonText: { color: '#000', fontWeight: '600', fontSize: 15 },
  secondaryButton: {
    backgroundColor: '#1c1c1c',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  secondaryButtonText: { color: '#fff', fontSize: 15 },
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd mobile && npm test -- --testPathPattern="GuideScreen"
```

예상 결과: 6개 테스트 모두 통과

- [ ] **Step 5: 전체 테스트 실행**

```bash
cd mobile && npm run lint && npm test
```

예상 결과: 모든 테스트 통과, lint 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add mobile/src/screens/GuideScreen.tsx \
        mobile/src/__tests__/GuideScreen.test.tsx
git commit -m "feat(mobile): GuideScreen 상태 머신 서브뷰 분리 (AcceptedView, MatchedView, InProgressView)"
```

---

## Task 5: ChatListScreen + AppNavigator 연결

**Files:**
- Create: `mobile/src/screens/ChatListScreen.tsx`
- Create: `mobile/src/__tests__/ChatListScreen.test.tsx`
- Modify: `mobile/src/navigation/AppNavigator.tsx`

- [ ] **Step 1: ChatListScreen.test.tsx 작성 (failing)**

`mobile/src/__tests__/ChatListScreen.test.tsx` 파일 생성:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ChatListScreen from '../screens/ChatListScreen';
import type { ChatRoomSummaryResponse } from '../types/api';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../hooks/useChat', () => ({
  useChatRooms: jest.fn(),
  useChatRoom: jest.fn(),
  useMessages: jest.fn(),
}));

const { useChatRooms } = jest.requireMock('../hooks/useChat') as {
  useChatRooms: jest.Mock;
};

const mockRooms: ChatRoomSummaryResponse[] = [
  {
    roomId: 1,
    requestId: 10,
    requestType: 'GUIDE',
    partnerName: '홍길동',
    lastMessagePreview: '안녕하세요!',
    lastMessageAt: new Date(Date.now() - 60000).toISOString(),
  },
  {
    roomId: 2,
    requestId: 20,
    requestType: 'TRANSLATION',
    partnerName: '김번역',
    lastMessagePreview: null,
    lastMessageAt: null,
  },
];

describe('ChatListScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('로딩 중 스피너를 표시한다', () => {
    useChatRooms.mockReturnValue({ data: undefined, isLoading: true });
    const { getByTestId } = render(<ChatListScreen />);
    expect(getByTestId('chat-list-loading')).toBeTruthy();
  });

  it('채팅방이 없을 때 empty state를 표시한다', () => {
    useChatRooms.mockReturnValue({ data: [], isLoading: false });
    const { getByTestId } = render(<ChatListScreen />);
    expect(getByTestId('empty-chat-list')).toBeTruthy();
  });

  it('채팅방 목록을 렌더한다', () => {
    useChatRooms.mockReturnValue({ data: mockRooms, isLoading: false });
    const { getByTestId } = render(<ChatListScreen />);
    expect(getByTestId('chat-room-row-1')).toBeTruthy();
    expect(getByTestId('chat-room-row-2')).toBeTruthy();
  });

  it('lastMessagePreview가 없으면 "대화를 시작해보세요"를 표시한다', () => {
    useChatRooms.mockReturnValue({ data: mockRooms, isLoading: false });
    const { getByText } = render(<ChatListScreen />);
    expect(getByText('대화를 시작해보세요')).toBeTruthy();
  });

  it('채팅방 행 탭 시 ChatRoom으로 navigate한다', () => {
    useChatRooms.mockReturnValue({ data: mockRooms, isLoading: false });
    const { getByTestId } = render(<ChatListScreen />);
    fireEvent.press(getByTestId('chat-room-row-1'));
    expect(mockNavigate).toHaveBeenCalledWith('ChatRoom', { roomId: 1, requestId: 10 });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd mobile && npm test -- --testPathPattern="ChatListScreen"
```

예상 결과: FAIL (ChatListScreen 파일이 없으므로)

- [ ] **Step 3: ChatListScreen.tsx 생성**

`mobile/src/screens/ChatListScreen.tsx` 파일 생성:

```tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useChatRooms } from '../hooks/useChat';
import type { ChatRoomSummaryResponse } from '../types/api';
import type { AppStackParamList } from '../navigation/AppNavigator';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${Math.floor(diffHr / 24)}일 전`;
}

function ChatRoomRow({
  room,
  onPress,
}: {
  room: ChatRoomSummaryResponse;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      testID={`chat-room-row-${room.roomId}`}
      style={styles.row}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowHeader}>
          <Text style={styles.partnerName}>{room.partnerName}</Text>
          <Text style={styles.typeBadge}>{room.requestType}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {room.lastMessagePreview ?? '대화를 시작해보세요'}
        </Text>
      </View>
      {room.lastMessageAt && (
        <Text style={styles.time}>{formatTime(room.lastMessageAt)}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function ChatListScreen() {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: rooms, isLoading } = useChatRooms();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator testID="chat-list-loading" color="#f59e0b" />
      </View>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <View style={styles.center}>
        <Text testID="empty-chat-list" style={styles.emptyText}>
          확정된 매칭이 없습니다
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={rooms}
      keyExtractor={(item) => String(item.roomId)}
      renderItem={({ item }) => (
        <ChatRoomRow
          room={item}
          onPress={() =>
            navigation.navigate('ChatRoom', {
              roomId: item.roomId,
              requestId: item.requestId,
            })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  emptyText: { color: '#525252', fontSize: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1c',
  },
  rowLeft: { flex: 1, marginRight: 8 },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  partnerName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  typeBadge: { color: '#f59e0b', fontSize: 10, fontWeight: '500' },
  preview: { color: '#a3a3a3', fontSize: 13 },
  time: { color: '#525252', fontSize: 11 },
});
```

- [ ] **Step 4: AppNavigator.tsx 에 ChatListScreen 연결**

`mobile/src/navigation/AppNavigator.tsx` 에서:

1. import 추가:
```tsx
import ChatListScreen from '../screens/ChatListScreen';
```

2. `RecentChatPlaceholder` 함수 전체 삭제:
```tsx
// 이 함수 전체 삭제
function RecentChatPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>매칭 확정 후 채팅이 열립니다</Text>
    </View>
  );
}
```

3. `MainTabs` 안의 Chat 탭 컴포넌트 교체:
```tsx
// 변경 전
<Tab.Screen name="Chat" component={RecentChatPlaceholder} options={{ title: '채팅' }} />

// 변경 후
<Tab.Screen name="Chat" component={ChatListScreen} options={{ title: '채팅' }} />
```

4. `styles` 객체에서 placeholder 스타일 삭제 (이제 미사용):
```ts
// 삭제
placeholder: { ... },
placeholderText: { ... },
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

```bash
cd mobile && npm test -- --testPathPattern="ChatListScreen"
```

예상 결과: 5개 테스트 모두 통과

- [ ] **Step 6: 전체 테스트 + lint 최종 확인**

```bash
cd mobile && npm run lint && npm test
```

예상 결과: 모든 테스트 통과, lint 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add mobile/src/screens/ChatListScreen.tsx \
        mobile/src/__tests__/ChatListScreen.test.tsx \
        mobile/src/navigation/AppNavigator.tsx
git commit -m "feat(mobile): ChatListScreen 신설, Chat 탭 활성화"
```

---

## 최종 검증

모든 Task 완료 후:

```bash
cd mobile && npm run lint && npm test
```

AC 체크리스트:
- [ ] Chat 탭 진입 시 채팅방 목록 표시 (빈 경우 empty state)
- [ ] 가이드 수락 → 탭 이동 → 돌아와도 AcceptedView 유지 (`useGuideActiveOffer` 서버 fetch)
- [ ] 여행자 가이드 확정 시 Alert 표시
- [ ] 가이드 MATCHED 상태에서 "서비스 시작" 버튼 표시, 클릭 시 InProgressView 전환
- [ ] 새 요청 STOMP 이벤트 → 가이드 목록 자동 갱신 (B1 fix)
- [ ] PaymentScreen 결제 완료 후 뒤로 가기 가능 (B2 fix)
- [ ] StatusBadge 한국어 레이블 표시
