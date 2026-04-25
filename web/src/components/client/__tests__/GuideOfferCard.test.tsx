import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import GuideOfferCard from '../GuideOfferCard';
import type { MatchOfferResponse } from '@/types/api';

const mockOffer: MatchOfferResponse = {
  id: 1,
  requestId: 10,
  guideId: 20,
  guideName: '홍길동',
  guideAvgRating: 4.8,
  status: 'PENDING',
  message: '도와드리겠습니다',
  createdAt: '2026-04-25T00:00:00Z',
};

describe('GuideOfferCard', () => {
  it('calls onConfirm with guideId when button clicked', async () => {
    const onConfirm = vi.fn();
    render(<GuideOfferCard offer={mockOffer} onConfirm={onConfirm} isPending={false} />);

    await userEvent.click(screen.getByRole('button', { name: /이 가이드로 확정/ }));
    expect(onConfirm).toHaveBeenCalledWith(20);
  });

  it('disables button when isPending is true', () => {
    render(<GuideOfferCard offer={mockOffer} onConfirm={vi.fn()} isPending={true} />);
    expect(screen.getByRole('button', { name: /이 가이드로 확정/ })).toBeDisabled();
  });
});
