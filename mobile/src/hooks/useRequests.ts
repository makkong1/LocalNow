import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { HelpRequestResponse, HelpRequestPageResponse, CreateRequestBody, RequestType } from '../types/api';

export function useMyRequests() {
  return useQuery({
    queryKey: ['requests', 'me'],
    queryFn: async () => {
      const res = await apiFetch<HelpRequestPageResponse>('/requests/me');
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
  });
}

interface OpenRequestsOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
  requestType?: RequestType | null;
  sortBy?: 'budgetAsc' | 'budgetDesc' | null;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export function useOpenRequests(options?: OpenRequestsOptions) {
  const { enabled, refetchInterval, requestType, sortBy, lat, lng, radiusKm } = options ?? {};
  return useQuery({
    queryKey: ['requests', 'open', { requestType: requestType ?? null, sortBy: sortBy ?? null, lat: lat ?? null, lng: lng ?? null }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (requestType) params.set('requestType', requestType);
      if (sortBy) params.set('sortBy', sortBy);
      if (lat != null) params.set('lat', String(lat));
      if (lng != null) params.set('lng', String(lng));
      if (radiusKm != null) params.set('radiusKm', String(radiusKm));
      const qs = params.toString();
      const res = await apiFetch<HelpRequestPageResponse>(`/requests/open${qs ? `?${qs}` : ''}`);
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
    enabled,
    refetchInterval,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateRequestBody) => {
      const res = await apiFetch<HelpRequestResponse>('/requests', { method: 'POST', body });
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests', 'me'] });
    },
  });
}
