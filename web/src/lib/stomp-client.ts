import 'client-only';
import { Client, type StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

type MessageHandler = (body: unknown) => void;
type ConnectionState = 'connecting' | 'connected' | 'disconnected';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8080/ws';
const MAX_RECONNECT = 3;

export class StompClient {
  private client: Client | null = null;
  private _connectionState: ConnectionState = 'disconnected';
  private reconnectCount = 0;
  private token: string = '';

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  connect(token: string): Promise<void> {
    this.token = token;
    this._connectionState = 'connecting';

    return new Promise((resolve, reject) => {
      this.client = new Client({
        webSocketFactory: () => new SockJS(WS_URL) as WebSocket,
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 0,
        onConnect: () => {
          this._connectionState = 'connected';
          this.reconnectCount = 0;
          resolve();
        },
        onDisconnect: () => {
          this._connectionState = 'disconnected';
        },
        onStompError: (frame) => {
          this._connectionState = 'disconnected';
          reject(new Error(frame.headers['message'] ?? 'STOMP error'));
        },
        onWebSocketError: () => {
          this._connectionState = 'disconnected';
          if (this.reconnectCount < MAX_RECONNECT) {
            this.reconnectCount++;
            this._connectionState = 'connecting';
            setTimeout(() => this.reconnect(), 5000);
          }
        },
      });
      this.client.activate();
    });
  }

  private reconnect() {
    if (this.client) {
      this.client.deactivate();
    }
    this.connect(this.token).catch(() => {
      this._connectionState = 'disconnected';
    });
  }

  disconnect(): void {
    this.reconnectCount = MAX_RECONNECT; // prevent reconnect
    this.client?.deactivate();
    this._connectionState = 'disconnected';
  }

  subscribe(destination: string, handler: MessageHandler): () => void {
    if (!this.client?.connected) {
      return () => {};
    }
    let sub: StompSubscription | null = null;
    sub = this.client.subscribe(destination, (msg) => {
      try {
        handler(JSON.parse(msg.body));
      } catch {
        handler(msg.body);
      }
    });
    return () => sub?.unsubscribe();
  }

  send(destination: string, body: unknown): void {
    if (!this.client?.connected) return;
    this.client.publish({
      destination,
      body: JSON.stringify(body),
    });
  }
}
