import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RequestCard from '../RequestCard';
import type { HelpRequestResponse } from '@/types/api';

const mockRequest: HelpRequestResponse = {
  id: 1,
  travelerId: 10,
  requestType: 'GUIDE',
  lat: 37.5665,
  lng: 126.978,
  description: '가이드 도움 요청',
  startAt: '2026-04-25T10:00:00Z',
  durationMin: 60,
  budgetKrw: 30000,
  status: 'OPEN',
  createdAt: '2026-04-25T00:00:00Z',
};

describe('RequestCard', () => {
  it('calls onAccept with requestId when 수락 clicked', async () => {
    const onAccept = vi.fn();
    render(<RequestCard request={mockRequest} onAccept={onAccept} isAccepting={false} />);

    await userEvent.click(screen.getByRole('button', { name: '수락' }));
    expect(onAccept).toHaveBeenCalledWith(1);
  });

  it('disables button when isAccepting is true', () => {
    render(<RequestCard request={mockRequest} onAccept={vi.fn()} isAccepting={true} />);
    expect(screen.getByRole('button', { name: '수락' })).toBeDisabled();
  });
});
