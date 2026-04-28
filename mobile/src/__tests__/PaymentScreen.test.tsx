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
