'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import type {
  HelpRequestResponse,
  MatchOfferResponse,
  ApiResponse,
  PageResponse,
  PaymentIntentResponse,
  ChatRoomResponse,
} from '@/types/api';
import RequestForm from './RequestForm';
import GuideOfferCard from './GuideOfferCard';
import ReviewForm from './ReviewForm';
import StatusBadge from './StatusBadge';
import RealtimeProvider from './RealtimeProvider';

const LocationMap = dynamic(() => import('./LocationMap'), { ssr: false });
const ChatPanel = dynamic(() => import('./ChatPanel'), { ssr: false });

const SEOUL = { lat: 37.5665, lng: 126.978 };

export default function TravelerView({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const [userLocation] = useState(SEOUL);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);

  const { data: requestsData } = useQuery({
    queryKey: ['myRequests'],
    queryFn: async () => {
      const res = await fetch('/api/requests');
      const d: ApiResponse<PageResponse<HelpRequestResponse>> = await res.json();
      return d.data?.items ?? [];
    },
    refetchInterval: 5000,
  });

  const requests = requestsData ?? [];
  const activeRequest = activeRequestId
    ? requests.find((r) => r.id === activeRequestId)
    : requests[0];

  const { data: offers } = useQuery({
    queryKey: ['offers', activeRequest?.id],
    queryFn: async () => {
      const res = await fetch(`/api/requests/${activeRequest!.id}/offers`);
      const d: ApiResponse<MatchOfferResponse[]> = await res.json();
      return d.data ?? [];
    },
    enabled: !!activeRequest && activeRequest.status === 'OPEN',
    refetchInterval: 5000,
  });

  const { data: chatRoom } = useQuery({
    queryKey: ['chatRoom', activeRequest?.id],
    queryFn: async () => {
      const res = await fetch(`/api/requests/${activeRequest!.id}/room`);
      const d: ApiResponse<ChatRoomResponse> = await res.json();
      return d.data ?? null;
    },
    enabled:
      !!activeRequest &&
      (activeRequest.status === 'MATCHED' ||
        activeRequest.status === 'IN_PROGRESS' ||
        activeRequest.status === 'COMPLETED'),
  });

  const confirmMutation = useMutation({
    mutationFn: async (guideId: number) => {
      const res = await fetch(`/api/requests/${activeRequest!.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideId }),
      });
      const d = await res.json();
      if (!d.success && d.error) throw new Error(d.error.message);
      return d;
    },
    onSuccess: async () => {
      await fetch('/api/payments/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: activeRequest!.id }),
      });
      qc.invalidateQueries({ queryKey: ['myRequests'] });
    },
  });

  const captureMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payments/${activeRequest!.id}/capture`, { method: 'POST' });
      const d: ApiResponse<PaymentIntentResponse> = await res.json();
      if (!d.success) throw new Error(d.error?.message ?? '결제 실패');
      return d.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myRequests'] }),
  });

  const handleNewRequest = useCallback(
    (req: HelpRequestResponse) => {
      setActiveRequestId(req.id);
      qc.invalidateQueries({ queryKey: ['myRequests'] });
    },
    [qc]
  );

  return (
    <>
      <RealtimeProvider
        userId={userId}
        role="TRAVELER"
        activeRequestId={activeRequest?.id}
      />
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        {/* left: map + form */}
        <div className="col-span-7 space-y-4">
          <LocationMap lat={userLocation.lat} lng={userLocation.lng} />
          <div className="rounded-lg bg-[#141414] border border-neutral-800 p-6">
            <RequestForm onSuccess={handleNewRequest} />
          </div>
          {chatRoom && (
            <ChatPanel roomId={chatRoom.id} currentUserId={userId} />
          )}
        </div>

        {/* right: request status panel */}
        <div className="col-span-5 space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">내 요청 현황</h2>

          {requests.length === 0 && (
            <p className="text-sm text-neutral-500">아직 요청이 없습니다.</p>
          )}

          {requests.map((req) => (
            <div
              key={req.id}
              onClick={() => setActiveRequestId(req.id)}
              className={`rounded-lg bg-[#141414] border p-4 cursor-pointer transition-colors ${
                activeRequest?.id === req.id
                  ? 'border-amber-500'
                  : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{req.requestType}</span>
                <StatusBadge status={req.status} />
              </div>
              <p className="text-xs text-neutral-500 tabular-nums">
                {req.budgetKrw.toLocaleString()}원 · {req.durationMin}분
              </p>
            </div>
          ))}

          {/* offer list */}
          {activeRequest?.status === 'OPEN' && (offers?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                가이드 제안 ({offers!.length})
              </h3>
              {offers!.map((offer) => (
                <GuideOfferCard
                  key={offer.id}
                  offer={offer}
                  onConfirm={(guideId) => confirmMutation.mutate(guideId)}
                  isPending={confirmMutation.isPending}
                />
              ))}
            </div>
          )}

          {/* payment capture */}
          {activeRequest?.status === 'MATCHED' && (
            <div className="rounded-lg bg-[#141414] border border-neutral-800 p-6 space-y-3">
              <h3 className="text-sm font-medium text-white">결제</h3>
              <p className="text-sm text-neutral-400">매칭이 완료되었습니다. 결제를 진행하세요.</p>
              {captureMutation.error && (
                <p className="text-xs text-red-400">{(captureMutation.error as Error).message}</p>
              )}
              <button
                onClick={() => captureMutation.mutate()}
                disabled={captureMutation.isPending || captureMutation.isSuccess}
                className="w-full rounded-md bg-amber-500 text-black font-medium px-4 py-2 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-sm"
              >
                {captureMutation.isSuccess
                  ? '결제 완료'
                  : captureMutation.isPending
                  ? '처리중...'
                  : '결제 완료(Mock)'}
              </button>
            </div>
          )}

          {/* review */}
          {activeRequest?.status === 'COMPLETED' && (
            <ReviewForm requestId={activeRequest.id} onSuccess={() => {}} />
          )}
        </div>
      </div>
    </>
  );
}
