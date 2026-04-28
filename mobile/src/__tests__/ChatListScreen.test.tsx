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
