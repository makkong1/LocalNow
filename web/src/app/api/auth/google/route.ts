import { NextResponse } from 'next/server';
import { BACKEND_BASE_URL } from '@/lib/env';

/**
 * 브라우저를 Spring Security Google OAuth2 시작 URL로 보낸다.
 * @see backend SecurityConfig#oauth2Login, application.yml spring.security.oauth2.client.registration.google
 */
export async function GET() {
  return NextResponse.redirect(`${BACKEND_BASE_URL}/oauth2/authorization/google`, 302);
}
