import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import type { MatchOfferResponse } from '@/types/api';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await apiFetch<MatchOfferResponse[]>(`/requests/${id}/offers`);
  const status = data.success ? 200 : 400;
  return NextResponse.json(data, { status });
}
