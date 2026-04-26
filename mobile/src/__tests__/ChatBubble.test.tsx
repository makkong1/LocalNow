import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import ChatBubble from '../components/ChatBubble';
import type { ChatMessageResponse } from '../types/api';

const baseMessage: ChatMessageResponse = {
  messageId: 1,
  roomId: 10,
  senderId: 100,
  content: '안녕하세요',
  sentAt: '2026-04-26T03:30:00.000Z',
  clientMessageId: 'test-uuid-1',
};

describe('ChatBubble', () => {
  it('applies amber background when isMine is true', () => {
    const { getByTestId } = render(<ChatBubble message={baseMessage} isMine={true} />);
    const bubble = getByTestId('chat-bubble');
    const flatStyle = StyleSheet.flatten(bubble.props.style as Parameters<typeof StyleSheet.flatten>[0]);
    expect(flatStyle.backgroundColor).toBe('#f59e0b');
  });

  it('applies dark surface background when isMine is false', () => {
    const { getByTestId } = render(<ChatBubble message={baseMessage} isMine={false} />);
    const bubble = getByTestId('chat-bubble');
    const flatStyle = StyleSheet.flatten(bubble.props.style as Parameters<typeof StyleSheet.flatten>[0]);
    expect(flatStyle.backgroundColor).toBe('#262626');
  });

  it('renders the message content', () => {
    const { getByText } = render(<ChatBubble message={baseMessage} isMine={true} />);
    expect(getByText('안녕하세요')).toBeTruthy();
  });

  it('renders sentAt time in HH:MM format', () => {
    const { getByText } = render(<ChatBubble message={baseMessage} isMine={true} />);
    // Time is rendered in HH:MM format (exact value depends on timezone of test runner)
    expect(getByText(/^\d{2}:\d{2}$/)).toBeTruthy();
  });
});
