import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { stompClient } from '../lib/stomp-client';
import { getToken } from '../lib/secure-storage';
import type { StompEvent, UserRole } from '../types/api';

interface UseRealtimeParams {
  userId: number;
  role: UserRole;
  activeRequestId?: number;
}

export function useRealtime({ userId, role, activeRequestId }: UseRealtimeParams): {
  isConnected: boolean;
} {
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  // Connect/disconnect lifecycle — reconnect only if user identity changes
  useEffect(() => {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws-native';

    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled || !token) return;
      stompClient.connect({
        url: wsUrl,
        token,
        onConnect: () => setIsConnected(true),
        onDisconnect: () => setIsConnected(false),
        onError: () => setIsConnected(false),
      });
    })();

    return () => {
      cancelled = true;
      stompClient.disconnect();
      setIsConnected(false);
    };
  }, [userId, role]);

  // All users: chat message push notifications
  useEffect(() => {
    if (!isConnected) return;
    const sub = stompClient.subscribe(`/topic/users/${userId}`, (body) => {
      try {
        const event = JSON.parse(body) as StompEvent;
        if (event.type === 'CHAT_MESSAGE') {
          queryClient.invalidateQueries({ queryKey: ['messages', event.roomId] });
        }
      } catch {
        // ignore malformed frames
      }
    });
    return () => sub.unsubscribe();
  }, [isConnected, userId, queryClient]);

  // Guide: new request notifications + match confirmed alerts
  useEffect(() => {
    if (!isConnected || role !== 'GUIDE') return;
    const sub = stompClient.subscribe(`/topic/guides/${userId}`, (body) => {
      try {
        const event = JSON.parse(body) as StompEvent;
        if (event.type === 'NEW_REQUEST') {
          queryClient.invalidateQueries({ queryKey: ['openRequests'] });
        } else if (event.type === 'MATCH_CONFIRMED') {
          Alert.alert('매칭 확정', '요청이 확정되었습니다.');
          queryClient.invalidateQueries({ queryKey: ['myRequests'] });
        }
      } catch {
        // ignore malformed frames
      }
    });
    return () => sub.unsubscribe();
  }, [isConnected, role, userId, queryClient]);

  // Traveler: offer accepted for currently active request
  useEffect(() => {
    if (!isConnected || role !== 'TRAVELER' || activeRequestId == null) return;
    const sub = stompClient.subscribe(`/topic/requests/${activeRequestId}`, (body) => {
      try {
        const event = JSON.parse(body) as StompEvent;
        if (event.type === 'OFFER_ACCEPTED') {
          queryClient.invalidateQueries({ queryKey: ['offers', activeRequestId] });
        }
      } catch {
        // ignore malformed frames
      }
    });
    return () => sub.unsubscribe();
  }, [isConnected, role, activeRequestId, queryClient]);

  return { isConnected };
}
