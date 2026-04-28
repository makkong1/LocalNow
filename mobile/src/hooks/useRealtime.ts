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

  // Connect/disconnect lifecycle — JWT 가 SecureStore 에 늦게 올 경우(오Auth 직후 등) 첫 페인트보다 늦을 수 있어 짧게 재시도
  useEffect(() => {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws-native';

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 20;
    const delayMs = 150;

    const tryConnectLoop = async () => {
      while (!cancelled && attempt < maxAttempts) {
        const token = await getToken();
        if (cancelled) {
          return;
        }
        if (token) {
          if (__DEV__) {
            console.log('[useRealtime] STOMP 연결 시도', wsUrl, attempt > 0 ? `(재시도 ${attempt})` : '');
          }
          stompClient.connect({
            url: wsUrl,
            token,
            onConnect: () => setIsConnected(true),
            onDisconnect: () => setIsConnected(false),
            onError: () => setIsConnected(false),
          });
          return;
        }
        attempt += 1;
        if (__DEV__ && attempt === 1) {
          console.warn('[useRealtime] JWT 아직 없음 — 짧게 재시도 (오Auth/로그인 직후 레이스 대비)');
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
      if (!cancelled && __DEV__) {
        console.warn('[useRealtime] JWT 를 못 받았습니다. 재로그인 또는 EXPO_PUBLIC_API_BASE_URL 확인');
      }
    };

    void tryConnectLoop();

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
          queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
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
          queryClient.invalidateQueries({ queryKey: ['requests', 'open'] });
        } else if (event.type === 'MATCH_CONFIRMED') {
          Alert.alert('매칭 확정', '요청이 확정되었습니다.');
          queryClient.invalidateQueries({ queryKey: ['requests', 'me'] });
          queryClient.invalidateQueries({ queryKey: ['offers', 'mine'] });
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
