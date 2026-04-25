'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiResponse, UserRole } from '@/types/api';

export default function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'TRAVELER' as UserRole,
    city: '',
  });
  const [error, setError] = useState<string | null>(null);
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
        setError(data.error?.message ?? '회원가입에 실패했습니다.');
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
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
          placeholder="••••••••"
        />
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
      {error && <p className="text-sm text-red-400">{error}</p>}
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
  );
}
