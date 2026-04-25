'use client';

import type { MatchOfferResponse } from '@/types/api';

interface Props {
  offer: MatchOfferResponse;
  onConfirm: (guideId: number) => void;
  isPending: boolean;
}

export default function GuideOfferCard({ offer, onConfirm, isPending }: Props) {
  return (
    <div className="rounded-lg bg-[#141414] border border-neutral-800 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-medium text-white">{offer.guideName}</p>
          <p className="text-xs text-neutral-500 tabular-nums mt-0.5">
            ★ {offer.guideAvgRating.toFixed(1)}
          </p>
          {offer.message && (
            <p className="text-sm text-neutral-300 leading-relaxed mt-2">{offer.message}</p>
          )}
        </div>
        <button
          onClick={() => onConfirm(offer.guideId)}
          disabled={isPending}
          className="shrink-0 rounded-md bg-amber-500 text-black font-medium px-4 py-2 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-sm"
        >
          이 가이드로 확정
        </button>
      </div>
    </div>
  );
}
