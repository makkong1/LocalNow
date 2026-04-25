import 'server-only';
import { BACKEND_BASE_URL } from './env';
import { getAuthToken } from './cookies';
import type { ApiResponse } from '@/types/api';

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) ?? {}),
  };

  try {
    const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const body = await res.json();
    return body as ApiResponse<T>;
  } catch (err) {
    return {
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Network error',
        fields: null,
      },
      meta: { requestId: '' },
    };
  }
}
