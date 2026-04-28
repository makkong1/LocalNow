import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
