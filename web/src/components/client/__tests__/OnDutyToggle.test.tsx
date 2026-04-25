import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnDutyToggle from '../OnDutyToggle';

describe('OnDutyToggle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls POST /api/guide/duty with location on toggle ON', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) =>
        success({ coords: { latitude: 37.5, longitude: 127.0 } } as GeolocationPosition)
      ),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<OnDutyToggle initialOnDuty={false} />);
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/guide/duty',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"onDuty":true'),
        })
      )
    );
  });

  it('shows error and keeps toggle off when geolocation fails', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((_success, error) =>
        error(new GeolocationPositionError())
      ),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
    });

    render(<OnDutyToggle initialOnDuty={false} />);
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(screen.getByText(/위치 정보를 가져올 수 없습니다/)).toBeInTheDocument()
    );
  });
});
