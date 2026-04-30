// Variables starting with 'mock' are allowed in jest.mock factories (babel-jest hoisting rule)
const mockActivate = jest.fn();
const mockDeactivate = jest.fn();
const mockSubscribeFn = jest.fn().mockReturnValue({ unsubscribe: jest.fn() });
const mockPublish = jest.fn();

jest.mock('@stomp/stompjs', () => ({
  Client: jest.fn().mockImplementation(() => ({
    activate: mockActivate,
    deactivate: mockDeactivate,
    subscribe: mockSubscribeFn,
    publish: mockPublish,
    active: false,
    connected: false,
  })),
}));

// Provide global WebSocket
const mockWebSocketInstance = { close: jest.fn(), readyState: 0, addEventListener: jest.fn() };
const MockWebSocket = jest.fn().mockReturnValue(mockWebSocketInstance);
(global as unknown as Record<string, unknown>).WebSocket = MockWebSocket;

import { stompClient } from '../lib/stomp-client';
import { Client } from '@stomp/stompjs';
const MockClient = Client as jest.MockedClass<typeof Client>;

describe('stompClient', () => {
  afterEach(() => {
    stompClient.disconnect();
    jest.clearAllMocks();
  });

  it('creates a STOMP Client and calls activate() when connect() is invoked', () => {
    stompClient.connect({
      url: 'ws://localhost:8080/ws-native',
      token: 'test-jwt-token',
    });

    expect(MockClient).toHaveBeenCalledTimes(1);
    expect(mockActivate).toHaveBeenCalledTimes(1);
  });

  it('passes Authorization header on connect', () => {
    stompClient.connect({
      url: 'ws://localhost:8080/ws-native',
      token: 'my-secret-token',
    });

    const constructorArg = MockClient.mock.calls[0][0];
    expect(constructorArg.connectHeaders).toEqual({
      Authorization: 'Bearer my-secret-token',
    });
  });

  it('uses webSocketFactory returning a WebSocket instance', () => {
    stompClient.connect({
      url: 'ws://localhost:8080/ws-native',
      token: 'test-token',
    });

    const constructorArg = MockClient.mock.calls[0][0];
    expect(typeof constructorArg.webSocketFactory).toBe('function');

    // Calling the factory should create a WebSocket with the provided URL
    constructorArg.webSocketFactory!();
    expect(MockWebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws-native');
  });

  it('calls deactivate() when disconnect() is invoked', () => {
    stompClient.connect({
      url: 'ws://localhost:8080/ws-native',
      token: 'test-token',
    });
    stompClient.disconnect();

    expect(mockDeactivate).toHaveBeenCalledTimes(1);
  });

  it('isConnected returns false before onConnect fires', () => {
    stompClient.connect({
      url: 'ws://localhost:8080/ws-native',
      token: 'test-token',
    });
    // onConnect is async — not yet fired in this synchronous test
    expect(stompClient.isConnected).toBe(false);
  });

  it('returns a no-op subscription when client is not initialized', () => {
    // stompClient.client is null before connect()
    const sub = stompClient.subscribe('/topic/test', jest.fn());
    expect(typeof sub.unsubscribe).toBe('function');
    // Should not throw
    expect(() => sub.unsubscribe()).not.toThrow();
  });
});
