import { getToken } from './secure-storage';
import type {
  ApiResponse,
  CertificationResponse,
  PublicProfileResponse,
  UserProfileResponse,
} from '../types/api';

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
          'EXPO_PUBLIC_API_BASE_URL 미설정. mobile/.env.local 예: EXPO_PUBLIC_API_BASE_URL=http://localhost:8080 (시뮬레이터·OAuth 세션은 host 통일; 실기기·Google 제약 시 HTTPS 터널 등)',
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

/** multipart/form-data 업로드용 — Content-Type 헤더를 설정하지 않아 boundary가 자동으로 붙는다 */
export async function apiFetchMultipart<T>(
  path: string,
  formData: FormData,
  method: string = 'POST',
): Promise<ApiResponse<T>> {
  const resolved = baseUrl();
  if (!resolved) {
    return {
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'EXPO_PUBLIC_API_BASE_URL 미설정',
        fields: null,
      },
      meta: { requestId: '' },
    };
  }

  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${resolved}${path}`, { method, headers, body: formData });
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

  uploadProfileImage(imageUri: string): Promise<ApiResponse<UserProfileResponse>> {
    const formData = new FormData();
    formData.append('file', { uri: imageUri, name: 'profile.jpg', type: 'image/jpeg' } as unknown as Blob);
    return apiFetchMultipart<UserProfileResponse>('/users/profile-image', formData);
  },

  getPublicProfile(userId: number): Promise<ApiResponse<PublicProfileResponse>> {
    return apiFetch<PublicProfileResponse>(`/users/${userId}/profile`, { requiresAuth: false });
  },

  getMyCertifications(): Promise<ApiResponse<CertificationResponse[]>> {
    return apiFetch<CertificationResponse[]>('/guide/certifications');
  },

  uploadCertification(name: string, fileUri: string): Promise<ApiResponse<CertificationResponse>> {
    const formData = new FormData();
    formData.append('file', { uri: fileUri, name: 'certification.pdf', type: 'application/pdf' } as unknown as Blob);
    formData.append('name', name);
    return apiFetchMultipart<CertificationResponse>('/guide/certifications', formData);
  },

  deleteCertification(certId: number): Promise<ApiResponse<void>> {
    return apiFetch<void>(`/guide/certifications/${certId}`, { method: 'DELETE' });
  },
};
