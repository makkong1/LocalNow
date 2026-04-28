import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { MatchOfferResponse } from '../types/api';

export function useOffers(requestId: number) {
  return useQuery({
    queryKey: ['offers', requestId],
    queryFn: async () => {
      const res = await apiFetch<MatchOfferResponse[]>(`/requests/${requestId}/offers`);
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, message }: { requestId: number; message?: string }) => {
      const res = await apiFetch<MatchOfferResponse>(`/requests/${requestId}/accept`, {
        method: 'POST',
        body: { message },
      });
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
    onSuccess: (_, { requestId }) => {
      qc.invalidateQueries({ queryKey: ['offers', requestId] });
      qc.invalidateQueries({ queryKey: ['requests', 'open'] });
      qc.invalidateQueries({ queryKey: ['offers', 'mine'] });
    },
  });
}

export function useConfirmGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, guideId }: { requestId: number; guideId: number }) => {
      const res = await apiFetch<MatchOfferResponse>(`/requests/${requestId}/confirm`, {
        method: 'POST',
        body: { guideId },
      });
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
    onSuccess: (_, { requestId }) => {
      qc.invalidateQueries({ queryKey: ['offers', requestId] });
      qc.invalidateQueries({ queryKey: ['requests', 'me'] });
    },
  });
}

export function useStartService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId }: { requestId: number }) => {
      const res = await apiFetch<void>(`/requests/${requestId}/start`, { method: 'POST' });
      if (!res.success) throw res.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers', 'mine'] });
    },
  });
}
