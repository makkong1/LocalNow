import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import { getAuthToken } from '@/lib/cookies';
import { BACKEND_BASE_URL } from '@/lib/env';
import type { HelpRequestResponse, PageResponse } from '@/types/api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor') ?? '';
  const size = searchParams.get('size') ?? '10';

  const qs = new URLSearchParams({ size });
  if (cursor) qs.set('cursor', cursor);

  const data = await apiFetch<PageResponse<HelpRequestResponse>>(`/requests/me?${qs}`);
  const status = data.success ? 200 : 400;
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = await getAuthToken();

  const backendRes = await fetch(`${BACKEND_BASE_URL}/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
