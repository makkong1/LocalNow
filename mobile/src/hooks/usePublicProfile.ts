import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { PublicProfileResponse } from '../types/api';

export function usePublicProfile(userId: number): UseQueryResult<PublicProfileResponse> {
  return useQuery({
    queryKey: ['publicProfile', userId],
    queryFn: async () => {
      const res = await apiClient.getPublicProfile(userId);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? '프로필 조회 실패');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}
