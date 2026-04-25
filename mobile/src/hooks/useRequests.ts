import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { HelpRequestResponse, HelpRequestPageResponse, CreateRequestBody } from '../types/api';

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

export function useOpenRequests(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['requests', 'open'],
    queryFn: async () => {
      const res = await apiFetch<HelpRequestPageResponse>('/requests/open');
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
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
