'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiError, ApiResponse, AuthResponse } from '@/types/api';
import ApiErrorDisplay from './ApiErrorDisplay';
import GoogleSignInButton from './GoogleSignInButton';
import GitHubSignInButton from './GitHubSignInButton';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data: ApiResponse<AuthResponse> = await res.json();

      if (data.success && data.data) {
        const { role } = data.data;
        if (role === 'GUIDE') router.push('/guide');
        else if (role === 'ADMIN') router.push('/admin');
        else router.push('/traveler');
      } else {
        setError(
          data.error ?? {
            code: 'INTERNAL_ERROR',
            message: '로그인에 실패했습니다.',
            fields: null,
          },
        );
      }
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: '네트워크 오류가 발생했습니다.', fields: null });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <GoogleSignInButton />
      <GitHubSignInButton />
      <p className="text-xs text-center text-neutral-500">Google·GitHub는 여행자로 가입·연동됩니다.</p>
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-neutral-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide text-neutral-500">
          <span className="bg-[#141414] px-2">또는 이메일</span>
        </div>
      </div>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-neutral-400 mb-1">이메일</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
          placeholder="••••••••"
        />
      </div>
      <ApiErrorDisplay error={error} fallback="로그인에 실패했습니다." />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-amber-500 text-black font-medium px-4 py-2 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500"
      >
        {loading ? '로그인 중...' : '로그인'}
      </button>
      <p className="text-sm text-neutral-500 text-center">
        계정이 없으신가요?{' '}
        <a href="/signup" className="text-amber-500 hover:text-amber-400">
          회원가입
        </a>
      </p>
    </form>
    </div>
  );
}
