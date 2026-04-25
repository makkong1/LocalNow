'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import type {
  HelpRequestResponse,
  ApiResponse,
  PageResponse,
  ChatRoomResponse,
} from '@/types/api';
import OnDutyToggle from './OnDutyToggle';
import RequestCard from './RequestCard';
import RealtimeProvider from './RealtimeProvider';

const ChatPanel = dynamic(() => import('./ChatPanel'), { ssr: false });

interface Props {
  userId: number;
}

export default function GuideView({ userId }: Props) {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);

  const { data: requestsData } = useQuery({
    queryKey: ['nearbyRequests'],
    queryFn: async () => {
      const res = await fetch('/api/requests?status=OPEN&size=20');
      const d: ApiResponse<PageResponse<HelpRequestResponse>> = await res.json();
      return d.data?.items ?? [];
    },
    refetchInterval: 3000,
  });

  const requests = (requestsData ?? []).filter((r) => r.status === 'OPEN');

  // find accepted request to show chat
  const { data: acceptedRequests } = useQuery({
    queryKey: ['myAcceptedRequests'],
    queryFn: async () => {
      const res = await fetch('/api/requests?size=10');
      const d: ApiResponse<PageResponse<HelpRequestResponse>> = await res.json();
      return (d.data?.items ?? []).filter(
        (r) => r.status === 'MATCHED' || r.status === 'IN_PROGRESS'
      );
    },
    refetchInterval: 5000,
  });

  const confirmedRequest = acceptedRequests?.[0];

  const { data: chatRoom } = useQuery({
    queryKey: ['guideChatRoom', confirmedRequest?.id],
    queryFn: async () => {
      const res = await fetch(`/api/requests/${confirmedRequest!.id}/room`);
      const d: ApiResponse<ChatRoomResponse> = await res.json();
      return d.data ?? null;
    },
    enabled: !!confirmedRequest,
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await fetch(`/api/requests/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!d.success && d.error) throw new Error(d.error.message);
      return d;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nearbyRequests'] }),
  });

  return (
    <>
      <RealtimeProvider
        userId={userId}
        role="GUIDE"
        onToast={(msg) => {
          setToast(msg);
          setTimeout(() => setToast(null), 4000);
        }}
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-amber-500 text-black px-4 py-2 text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        {/* left: on-duty panel */}
        <div className="col-span-4 space-y-4">
          <div className="rounded-lg bg-[#141414] border border-neutral-800 p-6 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">근무 상태</h2>
            <OnDutyToggle initialOnDuty={false} />
            <p className="text-xs text-neutral-500 leading-relaxed">
              근무 중 상태로 전환하면 주변 여행자 요청을 받을 수 있습니다.
            </p>
          </div>

          {chatRoom && (
            <ChatPanel roomId={chatRoom.id} currentUserId={userId} />
          )}
        </div>

        {/* right: request list */}
        <div className="col-span-8 space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            주변 요청 ({requests.length})
          </h2>

          {requests.length === 0 && (
            <p className="text-sm text-neutral-500">현재 주변에 열린 요청이 없습니다.</p>
          )}

          {acceptMutation.error && (
            <p className="text-sm text-red-400">{(acceptMutation.error as Error).message}</p>
          )}

          {requests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              onAccept={(id) => acceptMutation.mutate(id)}
              isAccepting={acceptMutation.isPending}
            />
          ))}
        </div>
      </div>
    </>
  );
}
