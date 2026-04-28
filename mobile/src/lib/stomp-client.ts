import { Client } from '@stomp/stompjs';

const devLog = (...args: unknown[]) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[LocalNow STOMP]', ...args);
  }
};

const devWarn = (...args: unknown[]) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[LocalNow STOMP]', ...args);
  }
};

export interface StompSubscription {
  unsubscribe: () => void;
}

interface StompClientOptions {
  url: string;
  token: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
}

class LocalNowStompClient {
  private client: Client | null = null;
  private _isConnected = false;

  connect(options: StompClientOptions): void {
    if (this.client?.active) return;

    devLog('connect →', options.url);

    this.client = new Client({
      webSocketFactory: () => {
        const ws = new WebSocket(options.url);
        ws.addEventListener('open', () => devLog('WebSocket open'));
        ws.addEventListener('error', (e) => devWarn('WebSocket error (네트워크/URL/백엔드 미기동 의심)', e));
        ws.addEventListener('close', (ev) =>
          devWarn('WebSocket close', 'code=', ev.code, 'reason=', ev.reason || '(none)'),
        );
        return ws;
      },
      connectHeaders: {
        Authorization: `Bearer ${options.token}`,
      },
      reconnectDelay: 5000,
      // React Native: NSString 브리지가 STOMP 프레임 끝 \0을 잘라냄 → 두 옵션으로 보완
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      onConnect: () => {
        this._isConnected = true;
        devLog('STOMP CONNECTED (이제 채팅 전송 가능)');
        options.onConnect?.();
      },
      onDisconnect: () => {
        this._isConnected = false;
        devLog('STOMP disconnected');
        options.onDisconnect?.();
      },
      onStompError: (frame) => {
        devWarn('STOMP ERROR frame', frame.command, frame.headers, frame.body);
        options.onError?.(frame);
      },
      onWebSocketError: (evt) => {
        devWarn('onWebSocketError', evt);
        options.onError?.(evt);
      },
      onWebSocketClose: (evt) => {
        devWarn('onWebSocketClose', evt.code, evt.reason);
      },
    });

    this.client.activate();
  }

  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this._isConnected = false;
  }

  subscribe(destination: string, callback: (body: string) => void): StompSubscription {
    if (!this.client || !this._isConnected) {
      return { unsubscribe: () => {} };
    }
    try {
      const sub = this.client.subscribe(destination, (message) => {
        callback(message.body);
      });
      return { unsubscribe: () => sub.unsubscribe() };
    } catch {
      return { unsubscribe: () => {} };
    }
  }

  send(destination: string, body: unknown): void {
    if (!this.client || !this._isConnected) {
      return;
    }
    try {
      this.client.publish({
        destination,
        body: JSON.stringify(body),
      });
    } catch {
      // no underlying connection — caller should 가드했으나 무시
    }
  }

  get isConnected(): boolean {
    return this._isConnected;
  }
}

export const stompClient = new LocalNowStompClient();
