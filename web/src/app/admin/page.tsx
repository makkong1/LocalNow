import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthToken } from '@/lib/cookies';
import { apiFetch } from '@/lib/api-client';
import type { AdminSummaryResponse, UserProfileResponse } from '@/types/api';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-[#141414] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-amber-500 tabular-nums">{value}</p>
    </div>
  );
}

export default async function AdminPage() {
  const token = await getAuthToken();
  if (!token) {
    redirect('/login');
  }

  const profile = await apiFetch<UserProfileResponse>('/auth/me');
  if (!profile.success || !profile.data) {
    redirect('/login');
  }
  if (profile.data.role !== 'ADMIN') {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white px-6 py-10">
        <h1 className="text-xl font-semibold text-amber-500">접근 거부</h1>
        <p className="mt-2 text-sm text-neutral-400">이 페이지는 관리자(ADMIN) 전용입니다.</p>
        <Link href="/traveler" className="mt-6 inline-block text-sm text-amber-500 hover:text-amber-400">
          ← 여행자 뷰로
        </Link>
      </main>
    );
  }

  const summaryRes = await apiFetch<AdminSummaryResponse>('/admin/summary');
  if (!summaryRes.success || !summaryRes.data) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white px-6 py-10">
        <h1 className="text-xl font-semibold">관리자</h1>
        <p className="mt-2 text-sm text-red-400">
          집계를 불러오지 못했습니다. {summaryRes.error?.message ?? ''}
        </p>
      </main>
    );
  }

  const s = summaryRes.data;
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-6 py-10">
      <div className="max-w-3xl">
        <p className="text-xs text-neutral-500">LocalNow · read-only (ADR-014)</p>
        <h1 className="mt-1 text-2xl font-semibold text-amber-500">대시보드</h1>
        <p className="mt-1 text-sm text-neutral-400">사용자·도움 요청 상태 집계</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="총 사용자" value={s.userCount} />
        <StatCard label="요청 OPEN" value={s.helpRequestsOpen} />
        <StatCard label="요청 MATCHED" value={s.helpRequestsMatched} />
        <StatCard label="요청 IN_PROGRESS" value={s.helpRequestsInProgress} />
        <StatCard label="요청 COMPLETED" value={s.helpRequestsCompleted} />
        <StatCard label="요청 CANCELLED" value={s.helpRequestsCancelled} />
      </div>

      <p className="mt-10 text-xs text-neutral-600">로컬 시드 관리자 계정은 ADR-014 및 README(로컬 개발)를 본다.</p>
    </main>
  );
}
