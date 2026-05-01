import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { GuideActiveOfferResponse, BaseLocationResponse } from '../types/api';

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

export function useGuideActiveOffer(options?: { enabled?: boolean }) {
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
    enabled: options?.enabled !== false,
  });
}

export function useGuideBaseLocation() {
  return useQuery<BaseLocationResponse | null>({
    queryKey: ['guide', 'base-location'],
    queryFn: async () => {
      const res = await apiFetch<BaseLocationResponse>('/guide/me/base-location');
      if (!res.success) return null;
      return res.data ?? null;
    },
  });
}

export function useSaveGuideBaseLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { lat: number; lng: number }) => {
      const res = await apiFetch<void>('/guide/me/base-location', { method: 'PUT', body });
      if (!res.success) throw res.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guide', 'base-location'] }),
  });
}
