'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiResponse, AuthResponse } from '@/types/api';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
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
        router.push(data.data.role === 'GUIDE' ? '/guide' : '/traveler');
      } else {
        setError(data.error?.message ?? '로그인에 실패했습니다.');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
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
      {error && <p className="text-sm text-red-400">{error}</p>}
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
  );
}
