import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import type { UserProfileResponse } from '@/types/api';

export async function GET() {
  const data = await apiFetch<UserProfileResponse>('/auth/me');
  const status = data.success ? 200 : data.error?.code === 'AUTH_UNAUTHENTICATED' ? 401 : 500;
  return NextResponse.json(data, { status });
}
