'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { StompClient } from '@/lib/stomp-client';
import type { StompEvent } from '@/types/api';

interface Props {
  userId: number;
  role: 'TRAVELER' | 'GUIDE';
  activeRequestId?: number;
  onToast?: (message: string) => void;
}

export default function RealtimeProvider({ userId, role, activeRequestId, onToast }: Props) {
  const qc = useQueryClient();
  const stompRef = useRef<StompClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    async function init() {
      const tokenRes = await fetch('/api/chat/socket-token');
      const { token } = await tokenRes.json();
      if (!token || cancelled) return;

      const stomp = new StompClient();
      stompRef.current = stomp;

      try {
        await stomp.connect(token);
        if (cancelled) { stomp.disconnect(); return; }

        if (role === 'GUIDE') {
          unsubs.push(
            stomp.subscribe(`/topic/guides/${userId}`, (body) => {
              const event = body as StompEvent;
              if (event.type === 'NEW_REQUEST') {
                qc.invalidateQueries({ queryKey: ['nearbyRequests'] });
              } else if (event.type === 'MATCH_CONFIRMED') {
                onToast?.('매칭이 확정되었습니다');
              }
            })
          );
        } else {
          if (activeRequestId) {
            unsubs.push(
              stomp.subscribe(`/topic/requests/${activeRequestId}`, (body) => {
                const event = body as StompEvent;
                if (event.type === 'OFFER_ACCEPTED') {
                  qc.invalidateQueries({ queryKey: ['offers', activeRequestId] });
                } else if (event.type === 'CHAT_MESSAGE') {
                  qc.invalidateQueries({ queryKey: ['chatRoom'] });
                }
              })
            );
          }
        }
      } catch {
        // silent — rely on polling fallback
      }
    }

    init();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      stompRef.current?.disconnect();
    };
  }, [userId, role, activeRequestId, qc, onToast]);

  return null;
}
