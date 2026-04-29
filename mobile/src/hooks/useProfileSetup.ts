import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { CertificationResponse, UserProfileResponse } from '../types/api';

export function useUpdateProfileImage(): UseMutationResult<UserProfileResponse, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (imageUri: string) => {
      const res = await apiClient.uploadProfileImage(imageUri);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '이미지 업로드 실패');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useUploadCertification(): UseMutationResult<
  CertificationResponse,
  Error,
  { name: string; fileUri: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, fileUri }: { name: string; fileUri: string }) => {
      const res = await apiClient.uploadCertification(name, fileUri);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '자격증 업로드 실패');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications', 'mine'] });
    },
  });
}

export function useDeleteCertification(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (certId: number) => {
      const res = await apiClient.deleteCertification(certId);
      if (!res.success) {
        throw new Error(res.error?.message ?? '자격증 삭제 실패');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications', 'mine'] });
    },
  });
}

export function useMyCertifications(): UseQueryResult<CertificationResponse[]> {
  return useQuery({
    queryKey: ['certifications', 'mine'],
    queryFn: async () => {
      const res = await apiClient.getMyCertifications();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '자격증 조회 실패');
      }
      return res.data;
    },
  });
}
