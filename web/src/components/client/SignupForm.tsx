'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiError, ApiResponse, UserRole } from '@/types/api';
import ApiErrorDisplay from './ApiErrorDisplay';
import GoogleSignInButton from './GoogleSignInButton';

export default function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'TRAVELER' as UserRole,
    city: '',
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data: ApiResponse<unknown> = await res.json();

      if (data.success) {
        router.push('/login');
      } else {
        setError(
          data.error ?? {
            code: 'INTERNAL_ERROR',
            message: '회원가입에 실패했습니다.',
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
      <p className="text-xs text-center text-neutral-500">Google은 여행자로 가입·연동됩니다.</p>
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
          name="email"
          value={form.email}
          onChange={handleChange}
          required
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1">비밀번호</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          required
          minLength={8}
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
          placeholder="••••••••"
        />
        <p className="mt-1 text-xs text-neutral-500">8자 이상 입력하세요.</p>
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1">이름</label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
          placeholder="홍길동"
        />
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1">역할</label>
        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white focus:outline-none focus:border-amber-500"
        >
          <option value="TRAVELER">여행자</option>
          <option value="GUIDE">가이드</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1">도시</label>
        <input
          type="text"
          name="city"
          value={form.city}
          onChange={handleChange}
          required
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
          placeholder="서울"
        />
      </div>
      <ApiErrorDisplay error={error} fallback="회원가입에 실패했습니다." />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-amber-500 text-black font-medium px-4 py-2 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500"
      >
        {loading ? '가입 중...' : '회원가입'}
      </button>
      <p className="text-sm text-neutral-500 text-center">
        이미 계정이 있으신가요?{' '}
        <a href="/login" className="text-amber-500 hover:text-amber-400">
          로그인
        </a>
      </p>
    </form>
    </div>
  );
}
