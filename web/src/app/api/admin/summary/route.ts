import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import type { AdminSummaryResponse } from '@/types/api';

export async function GET() {
  const data = await apiFetch<AdminSummaryResponse>('/admin/summary');
  const status = data.success
    ? 200
    : data.error?.code === 'AUTH_UNAUTHENTICATED'
      ? 401
      : data.error?.code === 'AUTH_FORBIDDEN'
        ? 403
        : 500;
  return NextResponse.json(data, { status });
}
