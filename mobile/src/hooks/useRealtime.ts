import { useEffect, useRef } from 'react';
import { getStompClient } from '../lib/stomp-client';
import type { NotificationPayload } from '../types/api';

export function useRealtime(
  destination: string,
  onMessage: (payload: NotificationPayload) => void,
  enabled = true
) {
  const callbackRef = useRef(onMessage);

  useEffect(() => {
    callbackRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;

    let unsubscribe: (() => void) | null = null;

    getStompClient().then((client) => {
      if (!client.connected) {
        client.activate();
      }
      client.onConnect = () => {
        const sub = client.subscribe(destination, (frame) => {
          try {
            const payload = JSON.parse(frame.body) as NotificationPayload;
            callbackRef.current(payload);
          } catch {
            // ignore malformed frames
          }
        });
        unsubscribe = () => sub.unsubscribe();
      };
    });

    return () => {
      unsubscribe?.();
    };
  }, [destination, enabled]);
}
