import { Client } from '@stomp/stompjs';

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

    this.client = new Client({
      webSocketFactory: () => new WebSocket(options.url),
      connectHeaders: {
        Authorization: `Bearer ${options.token}`,
      },
      reconnectDelay: 5000,
      onConnect: () => {
        this._isConnected = true;
        options.onConnect?.();
      },
      onDisconnect: () => {
        this._isConnected = false;
        options.onDisconnect?.();
      },
      onStompError: (frame) => {
        options.onError?.(frame);
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
    if (!this.client) {
      return { unsubscribe: () => {} };
    }
    const sub = this.client.subscribe(destination, (message) => {
      callback(message.body);
    });
    return { unsubscribe: () => sub.unsubscribe() };
  }

  send(destination: string, body: unknown): void {
    this.client?.publish({
      destination,
      body: JSON.stringify(body),
    });
  }

  get isConnected(): boolean {
    return this._isConnected;
  }
}

export const stompClient = new LocalNowStompClient();
