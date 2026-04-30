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

interface PendingPublish {
  destination: string;
  body: string;
}

class LocalNowStompClient {
  private client: Client | null = null;
  private _isConnected = false;
  private pendingPublishes: PendingPublish[] = [];
  private static readonly MAX_PENDING_PUBLISHES = 50;

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
      reconnectDelay: 1500,
      connectionTimeout: 8000,
      // React Native: NSString 브리지가 STOMP 프레임 끝 \0을 잘라냄 → 두 옵션으로 보완
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      onConnect: () => {
        this._isConnected = true;
        devLog('STOMP CONNECTED (이제 채팅 전송 가능)');
        this.flushPendingPublishes();
        options.onConnect?.();
      },
      onDisconnect: () => {
        this.markDisconnected(options.onDisconnect);
        devLog('STOMP disconnected');
      },
      onStompError: (frame) => {
        devWarn('STOMP ERROR frame', frame.command, frame.headers, frame.body);
        options.onError?.(frame);
      },
      onWebSocketError: (evt) => {
        this.markDisconnected(options.onDisconnect);
        devWarn('onWebSocketError', evt);
        options.onError?.(evt);
      },
      onWebSocketClose: (evt) => {
        this.markDisconnected(options.onDisconnect);
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
    this.pendingPublishes = [];
    this.markDisconnected();
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
    const serialized = JSON.stringify(body);
    if (!this.client || !this._isConnected) {
      this.enqueuePendingPublish(destination, serialized);
      return;
    }
    try {
      this.client.publish({
        destination,
        body: serialized,
      });
    } catch {
      // 연결 흔들림으로 publish 실패 시 복구 후 재전송을 위해 큐에 적재
      this.enqueuePendingPublish(destination, serialized);
    }
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  private markDisconnected(onDisconnect?: () => void): void {
    const wasConnected = this._isConnected;
    this._isConnected = false;
    if (wasConnected) {
      onDisconnect?.();
    }
  }

  private enqueuePendingPublish(destination: string, body: string): void {
    if (this.pendingPublishes.length >= LocalNowStompClient.MAX_PENDING_PUBLISHES) {
      this.pendingPublishes.shift();
    }
    this.pendingPublishes.push({ destination, body });
    devWarn('메시지를 대기열에 보관했습니다. reconnect 후 자동 전송합니다.', destination);
  }

  private flushPendingPublishes(): void {
    if (!this.client || !this._isConnected || this.pendingPublishes.length === 0) {
      return;
    }

    const queue = [...this.pendingPublishes];
    this.pendingPublishes = [];

    for (const item of queue) {
      try {
        this.client.publish(item);
      } catch {
        this.enqueuePendingPublish(item.destination, item.body);
        break;
      }
    }
  }
}

export const stompClient = new LocalNowStompClient();
