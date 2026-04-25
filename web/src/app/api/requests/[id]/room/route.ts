import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import type { ChatRoomResponse } from '@/types/api';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await apiFetch<ChatRoomResponse>(`/requests/${id}/room`);
  const status = data.success ? 200 : 400;
  return NextResponse.json(data, { status });
}
