import { NextResponse } from 'next/server';
import { BACKEND_BASE_URL } from '@/lib/env';

/**
 * 브라우저를 Spring Security GitHub OAuth2 시작 URL로 보낸다.
 * @see backend application.yml spring.security.oauth2.client.registration.github
 */
export async function GET() {
  return NextResponse.redirect(`${BACKEND_BASE_URL}/oauth2/authorization/github`, 302);
}
