import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_BASE_URL } from '@/lib/env';
import { setAuthToken } from '@/lib/cookies';
import type { ApiResponse, AuthResponse, UserProfileResponse } from '@/types/api';

/**
 * OAuth2 성공 리다이렉트 URL fragment(#access_token)는 서버로 전송되지 않으므로,
 * 클라이언트가 토큰을 이 라우트로 보내면 HttpOnly 쿠키를 심고 /auth/me 로 검증한다.
 */
export async function POST(req: NextRequest) {
  let accessToken: string;
  try {
    const body = (await req.json()) as { accessToken?: string };
    accessToken = (body?.accessToken ?? '').trim();
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'VALIDATION_FAILED', message: 'Invalid JSON', fields: null },
        meta: { requestId: '' },
      },
      { status: 422 },
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'VALIDATION_FAILED', message: 'accessToken required', fields: null },
        meta: { requestId: '' },
      },
      { status: 422 },
    );
  }

  const meRes = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meJson = (await meRes.json()) as ApiResponse<UserProfileResponse>;

  if (!meJson.success || !meJson.data) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'AUTH_UNAUTHENTICATED', message: 'Invalid or expired token', fields: null },
        meta: { requestId: meJson.meta?.requestId ?? '' },
      },
      { status: 401 },
    );
  }

  const profile = meJson.data;
  const auth: AuthResponse = {
    accessToken,
    userId: profile.id,
    role: profile.role,
    name: profile.name,
  };

  const res = NextResponse.json({
    success: true,
    data: auth,
    error: null,
    meta: { requestId: meJson.meta?.requestId ?? '' },
  } as ApiResponse<AuthResponse>);

  setAuthToken(accessToken, res);
  return res;
}
