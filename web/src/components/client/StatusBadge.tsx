'use client';

import type { HelpRequestStatus } from '@/types/api';

const STATUS_CONFIG: Record<HelpRequestStatus, { label: string; color: string }> = {
  OPEN: { label: '요청중', color: 'bg-yellow-500' },
  MATCHED: { label: '매칭됨', color: 'bg-amber-500' },
  IN_PROGRESS: { label: '진행중', color: 'bg-green-500' },
  COMPLETED: { label: '완료', color: 'bg-neutral-600' },
  CANCELLED: { label: '취소', color: 'bg-red-500' },
};

export default function StatusBadge({ status }: { status: HelpRequestStatus }) {
  const { label, color } = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-neutral-900 border border-neutral-800">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
