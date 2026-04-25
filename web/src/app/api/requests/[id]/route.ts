import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import type { HelpRequestResponse } from '@/types/api';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await apiFetch<HelpRequestResponse>(`/requests/${id}`);
  const status = data.success ? 200 : data.error?.code === 'REQUEST_NOT_FOUND' ? 404 : 400;
  return NextResponse.json(data, { status });
}
