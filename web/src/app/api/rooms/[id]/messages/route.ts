import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import type { ChatMessageResponse, PageResponse } from '@/types/api';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor') ?? '';
  const size = searchParams.get('size') ?? '50';

  const qs = new URLSearchParams({ size });
  if (cursor) qs.set('cursor', cursor);

  const data = await apiFetch<PageResponse<ChatMessageResponse>>(`/rooms/${id}/messages?${qs}`);
  const status = data.success ? 200 : 400;
  return NextResponse.json(data, { status });
}
