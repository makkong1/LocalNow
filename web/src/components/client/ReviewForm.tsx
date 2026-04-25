'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ApiResponse, ReviewResponse } from '@/types/api';

interface Props {
  requestId: number;
  onSuccess: () => void;
}

export default function ReviewForm({ requestId, onSuccess }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/requests/${requestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment || null }),
      });
      const data: ApiResponse<ReviewResponse> = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? '리뷰 실패');
      return data.data;
    },
    onSuccess,
  });

  return (
    <div className="rounded-lg bg-[#141414] border border-neutral-800 p-6 space-y-4">
      <h3 className="text-sm font-medium uppercase tracking-wide text-neutral-500">리뷰 작성</h3>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => setRating(v)}
            className={`text-xl ${v <= rating ? 'text-amber-500' : 'text-neutral-700'}`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="한 줄 후기 (선택)"
        className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 resize-none"
      />

      {mutation.error && (
        <p className="text-xs text-red-400">{(mutation.error as Error).message}</p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || mutation.isSuccess}
        className="w-full rounded-md bg-amber-500 text-black font-medium px-4 py-2 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-sm"
      >
        {mutation.isSuccess ? '리뷰 완료' : mutation.isPending ? '제출 중...' : '리뷰 제출'}
      </button>
    </div>
  );
}
