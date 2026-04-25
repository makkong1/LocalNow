import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_BASE_URL } from '@/lib/env';
import { setAuthToken } from '@/lib/cookies';
import type { ApiResponse, AuthResponse } from '@/types/api';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const backendRes = await fetch(`${BACKEND_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data: ApiResponse<AuthResponse> = await backendRes.json();

  const res = NextResponse.json(data, { status: backendRes.status });

  if (data.success && data.data?.accessToken) {
    setAuthToken(data.data.accessToken, res);
  }

  return res;
}
