import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { GuideActiveOfferResponse } from '../types/api';

export function useSetDuty() {
  return useMutation({
    mutationFn: async ({
      onDuty,
      lat,
      lng,
    }: {
      onDuty: boolean;
      lat?: number;
      lng?: number;
    }) => {
      const res = await apiFetch<void>('/guide/duty', {
        method: 'POST',
        body: { onDuty, lat, lng },
      });
      if (!res.success) throw res.error;
    },
  });
}

export function useGuideActiveOffer() {
  return useQuery<GuideActiveOfferResponse | null>({
    queryKey: ['offers', 'mine'],
    queryFn: async () => {
      const res = await apiFetch<GuideActiveOfferResponse>('/offers/mine');
      if (!res.success) {
        if (res.error?.code === 'NOT_FOUND') return null;
        throw res.error;
      }
      return res.data;
    },
  });
}
