import type { Metadata } from 'next';
import './globals.css';
import { getAuthToken } from '@/lib/cookies';
import { apiFetch } from '@/lib/api-client';
import type { UserProfileResponse } from '@/types/api';
import LogoutButton from '@/components/client/LogoutButton';

export const metadata: Metadata = {
  title: 'LocalNow',
  description: '여행 중 실시간 현지 가이드 매칭 플랫폼',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getAuthToken();
  let profile: UserProfileResponse | null = null;

  if (token) {
    const res = await apiFetch<UserProfileResponse>('/auth/me');
    if (res.success && res.data) profile = res.data;
  }

  return (
    <html lang="ko" className="dark">
      <body className="bg-neutral-950 text-white min-h-screen min-w-[1024px]">
        {/* mobile fallback banner */}
        <div className="hidden max-[1023px]:block bg-neutral-900 border-b border-neutral-800 px-4 py-2 text-sm text-neutral-400 text-center">
          시연은 데스크톱(1280px 이상)에서 확인해주세요.
        </div>

        {profile && (
          <header className="border-b border-neutral-800 bg-neutral-950">
            <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
              <span className="text-base font-semibold text-white">LocalNow</span>
              <div className="flex items-center gap-4">
                <span className="text-sm text-neutral-400">
                  {profile.name}{' '}
                  <span className="text-xs text-neutral-600">
                    {profile.role === 'GUIDE' ? '가이드' : '여행자'}
                  </span>
                </span>
                <LogoutButton />
              </div>
            </div>
          </header>
        )}

        {children}
      </body>
    </html>
  );
}
