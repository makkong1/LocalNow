import { getToken } from './secure-storage';
import type { ApiResponse } from '../types/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; requiresAuth?: boolean } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, requiresAuth = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return res.json() as Promise<ApiResponse<T>>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: msg, fields: null },
      meta: { requestId: '' },
    };
  }
}

export const apiClient = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
