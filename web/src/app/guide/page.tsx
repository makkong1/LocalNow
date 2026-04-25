import { redirect } from 'next/navigation';
import { getAuthToken } from '@/lib/cookies';
import { apiFetch } from '@/lib/api-client';
import type { UserProfileResponse } from '@/types/api';
import QueryProvider from '@/components/client/QueryProvider';
import GuideView from '@/components/client/GuideView';

export default async function GuidePage() {
  const token = await getAuthToken();
  if (!token) redirect('/login');

  const profile = await apiFetch<UserProfileResponse>('/auth/me');
  if (!profile.success || !profile.data) redirect('/login');
  if (profile.data.role !== 'GUIDE') redirect('/traveler');

  return (
    <QueryProvider>
      <GuideView userId={profile.data.id} />
    </QueryProvider>
  );
}
