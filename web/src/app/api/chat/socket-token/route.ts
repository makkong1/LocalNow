import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/cookies';

export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  return NextResponse.json({ token });
}
