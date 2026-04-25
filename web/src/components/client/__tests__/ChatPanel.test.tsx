import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock stomp-client before importing ChatPanel
vi.mock('@/lib/stomp-client', () => {
  const mockSend = vi.fn();
  const mockDisconnect = vi.fn();
  const mockSubscribe = vi.fn().mockReturnValue(() => {});
  const mockConnect = vi.fn().mockResolvedValue(undefined);

  class MockStompClient {
    send = mockSend;
    disconnect = mockDisconnect;
    subscribe = mockSubscribe;
    connect = mockConnect;
    get connectionState() { return 'connected' as const; }
  }

  return { StompClient: MockStompClient, mockSend, mockSubscribe };
});

// @ts-expect-error - accessing mock internals
const { mockSend } = await import('@/lib/stomp-client');

import ChatPanel from '../ChatPanel';

const emptyHistoryResponse = {
  success: true,
  data: { items: [], nextCursor: null },
  error: null,
  meta: { requestId: '' },
};

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/messages')) {
        return Promise.resolve({
          json: () => Promise.resolve(emptyHistoryResponse),
        });
      }
      if (String(url).includes('socket-token')) {
        return Promise.resolve({ json: () => Promise.resolve({ token: 'mock-token' }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
  });

  it('fetches message history on render', async () => {
    render(<ChatPanel roomId={1} currentUserId={10} />);
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/messages'))
    );
  });

  it('calls StompClient.send with clientMessageId when 전송 clicked', async () => {
    render(<ChatPanel roomId={1} currentUserId={10} />);

    await waitFor(() => screen.getByPlaceholderText('메시지를 입력하세요...'));

    const input = screen.getByPlaceholderText('메시지를 입력하세요...');
    await userEvent.type(input, 'Hello');
    await userEvent.click(screen.getByRole('button', { name: '전송' }));

    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith(
        '/app/rooms/1/messages',
        expect.objectContaining({ content: 'Hello', clientMessageId: expect.any(String) })
      )
    );
  });

  it('disables send button when disconnected', async () => {
    const { StompClient } = await import('@/lib/stomp-client');
    vi.spyOn(StompClient.prototype, 'connectionState', 'get').mockReturnValue('disconnected');

    render(<ChatPanel roomId={1} currentUserId={10} />);
    await waitFor(() => screen.getByRole('button', { name: '전송' }));

    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });
});
