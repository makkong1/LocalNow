import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import GuideOfferCard from '../components/GuideOfferCard';
import type { MatchOfferResponse } from '../types/api';

const mockOffer: MatchOfferResponse = {
  id: 1,
  requestId: 10,
  guideId: 20,
  guideName: '김가이드',
  guideAvgRating: 4.5,
  status: 'PENDING',
  message: '도와드리겠습니다!',
  createdAt: new Date().toISOString(),
};

describe('GuideOfferCard', () => {
  it('calls onConfirm with guideId when confirm button is pressed', () => {
    const mockConfirm = jest.fn();
    const { getByTestId } = render(
      <GuideOfferCard
        offer={mockOffer}
        hasCertification={false}
        onPressProfile={jest.fn()}
        onConfirm={mockConfirm}
        isConfirming={false}
      />,
    );

    fireEvent.press(getByTestId('confirm-button'));
    expect(mockConfirm).toHaveBeenCalledWith(mockOffer.guideId);
  });

  it('disables confirm button when isConfirming is true', () => {
    const { getByTestId } = render(
      <GuideOfferCard
        offer={mockOffer}
        hasCertification={false}
        onPressProfile={jest.fn()}
        onConfirm={jest.fn()}
        isConfirming={true}
      />,
    );
    expect(getByTestId('confirm-button')).toBeDisabled();
  });

  it('does not call onConfirm when button is disabled', () => {
    const mockConfirm = jest.fn();
    const { getByTestId } = render(
      <GuideOfferCard
        offer={mockOffer}
        hasCertification={false}
        onPressProfile={jest.fn()}
        onConfirm={mockConfirm}
        isConfirming={true}
      />,
    );

    fireEvent.press(getByTestId('confirm-button'));
    expect(mockConfirm).not.toHaveBeenCalled();
  });
});
