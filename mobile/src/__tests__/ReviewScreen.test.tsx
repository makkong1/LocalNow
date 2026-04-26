import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import ReviewScreen from '../screens/ReviewScreen';

const mockMutateAsync = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../hooks/useReview', () => ({
  useCreateReview: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

const route: StackScreenProps<AppStackParamList, 'Review'>['route'] = {
  key: 'Review',
  name: 'Review',
  params: { requestId: 1, guideId: 2 },
};

const navigation = {
  navigate: mockNavigate,
  replace: jest.fn(),
} as StackScreenProps<AppStackParamList, 'Review'>['navigation'];

describe('ReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not submit without rating (submit button disabled)', () => {
    const { getByTestId } = render(<ReviewScreen route={route} navigation={navigation} />);
    const submit = getByTestId('review-submit-button');
    expect(submit.props.accessibilityState?.disabled ?? submit.props.disabled).toBe(true);
  });

  it('shows success message after review submit succeeds', async () => {
    mockMutateAsync.mockResolvedValueOnce({});

    const { getByTestId, getByText } = render(
      <ReviewScreen route={route} navigation={navigation} />
    );

    await act(async () => {
      fireEvent.press(getByTestId('star-4'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('review-submit-button'));
    });

    await waitFor(() => {
      expect(getByTestId('review-success-message')).toBeTruthy();
    });
    expect(getByText('리뷰를 작성하셨습니다. 감사합니다.')).toBeTruthy();
  });

  // Note: submit failure UI 는 ReviewForm+React Query isError; 여기서는 success 경로를 검증한다.
});
