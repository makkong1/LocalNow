import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { ChatRoomResponse, ChatMessageResponse, ChatRoomSummaryResponse } from '../types/api';

export function useChatRoom(requestId: number) {
  return useQuery({
    queryKey: ['chatRoom', requestId],
    queryFn: async () => {
      const res = await apiFetch<ChatRoomResponse>(`/chat/requests/${requestId}/room`);
      if (!res.success) {
        if (res.error?.code === 'REQUEST_NOT_FOUND') return null;
        throw res.error;
      }
      return res.data;
    },
  });
}

export function useMessages(roomId: number) {
  return useQuery({
    queryKey: ['messages', roomId],
    queryFn: async () => {
      const res = await apiFetch<ChatMessageResponse[]>(`/chat/rooms/${roomId}/messages`);
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
  });
}

export function useChatRooms() {
  return useQuery<ChatRoomSummaryResponse[]>({
    queryKey: ['chatRooms'],
    queryFn: async () => {
      const res = await apiFetch<ChatRoomSummaryResponse[]>('/chat/rooms');
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
  });
}
