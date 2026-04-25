import { Client } from '@stomp/stompjs';
import { getToken } from './secure-storage';

const WS_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/^http/, 'ws') + '/ws-native';

let client: Client | null = null;

export async function getStompClient(): Promise<Client> {
  if (client?.connected) return client;

  const token = await getToken();

  client = new Client({
    webSocketFactory: () => new WebSocket(WS_URL),
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    reconnectDelay: 5000,
  });

  return client;
}

export function disconnectStomp(): void {
  client?.deactivate();
  client = null;
}
