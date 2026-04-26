'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ApiError, ApiResponse, AuthResponse } from '@/types/api';
import ApiErrorDisplay from '@/components/client/ApiErrorDisplay';

/**
 * Google OAuth2 완료 후:
 * - 성공: /oauth/callback#access_token=... (백엔드 OAuth2LoginSuccessHandler)
 * - 실패: /oauth/callback?error=1&oauth2Error=... (백엔드 OAuth2LoginFailureHandler)
 */
function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (searchParams.get('error') === '1' || searchParams.get('oauth2Error')) {
      const msg = searchParams.get('oauth2Error') ?? 'Google 로그인에 실패했습니다.';
      setError({
        code: 'AUTH_UNAUTHENTICATED',
        message: decodeURIComponent(msg),
        fields: null,
      });
      return;
    }

    const run = async () => {
      const h = window.location.hash;
      if (!h || h.length < 2) {
        setError({
          code: 'VALIDATION_FAILED',
          message: '로그인 응답이 없습니다. 다시 시도해주세요.',
          fields: null,
        });
        return;
      }
      const params = new URLSearchParams(h.startsWith('#') ? h.slice(1) : h);
      const raw = params.get('access_token');
      if (!raw) {
        setError({
          code: 'VALIDATION_FAILED',
          message: '토큰을 받지 못했습니다.',
          fields: null,
        });
        return;
      }
      const accessToken = decodeURIComponent(raw);
      const res = await fetch('/api/auth/oauth-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
      const data: ApiResponse<AuthResponse> = await res.json();

      if (data.success && data.data) {
        if (window.history?.replaceState) {
          window.history.replaceState(null, '', '/oauth/callback');
        }
        const { role } = data.data;
        if (role === 'GUIDE') router.replace('/guide');
        else if (role === 'ADMIN') router.replace('/admin');
        else router.replace('/traveler');
        return;
      }
      setError(
        data.error ?? {
          code: 'INTERNAL_ERROR',
          message: '세션을 만들 수 없습니다.',
          fields: null,
        },
      );
    };

    void run();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="w-full max-w-sm space-y-4">
        <ApiErrorDisplay error={error} fallback="Google 로그인에 실패했습니다." />
        <a
          href="/login"
          className="block w-full text-center text-sm text-amber-500 hover:text-amber-400"
        >
          로그인으로 돌아가기
        </a>
      </div>
    );
  }

  return (
    <p className="text-sm text-neutral-400" role="status">
      Google 계정으로 로그인하는 중…
    </p>
  );
}

export function OAuthCallbackClient() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-neutral-400" role="status">
          준비 중…
        </p>
      }
    >
      <OAuthCallbackInner />
    </Suspense>
  );
}
