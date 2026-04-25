import { apiFetch } from '../lib/api-client';

jest.mock('../lib/secure-storage', () => ({
  getToken: jest.fn(),
}));

import { getToken } from '../lib/secure-storage';
const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('apiFetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue(null);
  });

  it('returns data on success response', async () => {
    const body = { success: true, data: { id: 1 }, error: null, meta: { requestId: 'r1' } };
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve(body) });

    const result = await apiFetch<{ id: number }>('/test', { requiresAuth: false });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1 });
  });

  it('adds Authorization header when requiresAuth is true and token exists', async () => {
    mockGetToken.mockResolvedValue('my-secret-token');
    const body = { success: true, data: {}, error: null, meta: { requestId: 'r2' } };
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve(body) });

    await apiFetch('/secure-endpoint');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-secret-token');
  });

  it('does not add Authorization header when requiresAuth is false', async () => {
    const body = { success: true, data: {}, error: null, meta: { requestId: 'r3' } };
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve(body) });

    await apiFetch('/public-endpoint', { requiresAuth: false });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('returns INTERNAL_ERROR on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await apiFetch('/test', { requiresAuth: false });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INTERNAL_ERROR');
    expect(result.error?.message).toBe('Network error');
  });

  it('returns INTERNAL_ERROR with generic message on non-Error rejection', async () => {
    mockFetch.mockRejectedValueOnce('unexpected');

    const result = await apiFetch('/test', { requiresAuth: false });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INTERNAL_ERROR');
  });
});
