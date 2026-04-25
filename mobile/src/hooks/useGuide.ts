import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';

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
