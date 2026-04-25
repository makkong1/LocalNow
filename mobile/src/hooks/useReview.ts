import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { ReviewResponse } from '../types/api';

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      rating,
      comment,
    }: {
      requestId: number;
      rating: number;
      comment?: string;
    }) => {
      const res = await apiFetch<ReviewResponse>(`/requests/${requestId}/review`, {
        method: 'POST',
        body: { rating, comment },
      });
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
    onSuccess: (_, { requestId }) => {
      qc.invalidateQueries({ queryKey: ['requests', 'me'] });
      qc.invalidateQueries({ queryKey: ['requests', requestId] });
    },
  });
}
