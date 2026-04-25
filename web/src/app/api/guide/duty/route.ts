import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/cookies';
import { BACKEND_BASE_URL } from '@/lib/env';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = await getAuthToken();

  const backendRes = await fetch(`${BACKEND_BASE_URL}/guide/duty`, {
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
