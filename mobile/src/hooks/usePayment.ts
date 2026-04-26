import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import type { PaymentIntentResponse } from '../types/api';

export function usePaymentIntent(requestId: number) {
  return useQuery({
    queryKey: ['payment', requestId],
    queryFn: async () => {
      const res = await apiFetch<PaymentIntentResponse>(`/payments/${requestId}`);
      if (!res.success) {
        if (res.error?.code === 'REQUEST_NOT_FOUND') return null;
        // Spring NOT_FOUND 는 ApiResponse code 가 INTERNAL_ERROR 로 올 수 있음
        const msg = res.error?.message ?? '';
        if (msg.toLowerCase().includes('not found') || msg.includes('Payment intent not found')) {
          return null;
        }
        throw res.error;
      }
      return res.data;
    },
  });
}

export function useCreatePaymentIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId }: { requestId: number }) => {
      const res = await apiFetch<PaymentIntentResponse>('/payments/intent', {
        method: 'POST',
        body: { requestId },
      });
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['payment', data.requestId] });
    },
  });
}

export function useCapturePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId }: { requestId: number }) => {
      const res = await apiFetch<PaymentIntentResponse>(`/payments/${requestId}/capture`, {
        method: 'POST',
      });
      if (!res.success || res.data == null) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['payment', data.requestId] });
      qc.invalidateQueries({ queryKey: ['requests', 'me'] });
    },
  });
}
