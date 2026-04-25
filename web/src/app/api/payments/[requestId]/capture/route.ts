import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/cookies';
import { BACKEND_BASE_URL } from '@/lib/env';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  const token = await getAuthToken();

  const backendRes = await fetch(`${BACKEND_BASE_URL}/payments/${requestId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
