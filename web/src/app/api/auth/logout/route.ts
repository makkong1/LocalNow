import { NextResponse } from 'next/server';
import { clearAuthToken } from '@/lib/cookies';

export async function POST() {
  const res = NextResponse.json({ success: true });
  clearAuthToken(res);
  return res;
}
