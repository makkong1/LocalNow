'use client';

import type { HelpRequestResponse } from '@/types/api';
import StatusBadge from './StatusBadge';

interface Props {
  request: HelpRequestResponse;
  guideLat?: number;
  guideLng?: number;
  onAccept: (requestId: number) => void;
  isAccepting: boolean;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const REQUEST_TYPE_LABEL: Record<string, string> = {
  GUIDE: '가이드',
  TRANSLATION: '통역',
  FOOD: '음식',
  EMERGENCY: '긴급',
};

export default function RequestCard({ request, guideLat, guideLng, onAccept, isAccepting }: Props) {
  const distance =
    guideLat !== undefined && guideLng !== undefined
      ? haversineKm(guideLat, guideLng, request.lat, request.lng).toFixed(1)
      : null;

  return (
    <div className="rounded-lg bg-[#141414] border border-neutral-800 p-6 hover:bg-[#1c1c1c] hover:border-neutral-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-white">
              {REQUEST_TYPE_LABEL[request.requestType] ?? request.requestType}
            </span>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-xs text-neutral-500 tabular-nums">
            {distance !== null ? `${distance}km · ` : ''}
            {request.durationMin}분 · {request.budgetKrw.toLocaleString()}원
          </p>
          {request.description && (
            <p className="text-sm text-neutral-300 leading-relaxed line-clamp-2">
              {request.description}
            </p>
          )}
        </div>
        {request.status === 'OPEN' && (
          <button
            onClick={() => onAccept(request.id)}
            disabled={isAccepting}
            className="shrink-0 rounded-md bg-neutral-800 text-white px-4 py-2 hover:bg-neutral-700 disabled:opacity-50 text-sm"
          >
            수락
          </button>
        )}
      </div>
    </div>
  );
}
