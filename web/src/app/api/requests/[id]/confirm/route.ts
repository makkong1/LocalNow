import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/cookies';
import { BACKEND_BASE_URL } from '@/lib/env';
import type { MatchOfferResponse } from '@/types/api';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const token = await getAuthToken();

  const backendRes = await fetch(`${BACKEND_BASE_URL}/requests/${id}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data: MatchOfferResponse = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
