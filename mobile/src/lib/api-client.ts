import { getToken } from './secure-storage';
import type { ApiResponse } from '../types/api';

/** 매 요청 시 읽음 — Jest 등에서 env 주입 시점과 맞추기 위함 */
function baseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  return raw.replace(/\/$/, '');
}

/** RN/fetch 가 던지는 영문 메시지를 사용자용 한국어로 */
function localizeFetchFailure(raw: string): string {
  const m = raw.trim().toLowerCase();
  if (m.includes('network request failed')) {
    return '네트워크에 연결할 수 없습니다. Wi-Fi와 서버 주소(EXPO_PUBLIC_API_BASE_URL, 맥과 같은 LAN·포트)를 확인해 주세요.';
  }
  if (m.includes('failed to fetch')) {
    return '서버에 연결할 수 없습니다.';
  }
  if (m.includes('aborted') || m === 'aborted') {
    return '요청이 취소되었습니다.';
  }
  if (m.includes('internet connection') && m.includes('offline')) {
    return '인터넷 연결을 확인해 주세요.';
  }
  if (m === 'network error' || m.includes('load failed')) {
    return '연결에 실패했습니다.';
  }
  // 알 수 없는 영문 등 — 사용자에게는 고정 문구
  if (raw.length === 0 || isAsciiOnly(raw)) {
    return '연결에 실패했습니다.';
  }
  return raw;
}

function isAsciiOnly(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) {
      return false;
    }
  }
  return true;
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; requiresAuth?: boolean } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, requiresAuth = true } = options;

  const resolved = baseUrl();
  if (!resolved) {
    return {
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          'EXPO_PUBLIC_API_BASE_URL 미설정. mobile/.env.local 에 예: EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:8081 (실기기는 맥 LAN IP, 포트는 백엔드와 동일)',
        fields: null,
      },
      meta: { requestId: '' },
    };
  }

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
    const res = await fetch(`${resolved}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return res.json() as Promise<ApiResponse<T>>;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const msg = localizeFetchFailure(raw);
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
