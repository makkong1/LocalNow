import { redirect } from 'next/navigation';
import { getAuthToken } from '@/lib/cookies';
import { apiFetch } from '@/lib/api-client';
import type { UserProfileResponse } from '@/types/api';
import QueryProvider from '@/components/client/QueryProvider';
import TravelerView from '@/components/client/TravelerView';

export default async function TravelerPage() {
  const token = await getAuthToken();
  if (!token) redirect('/login');

  const profile = await apiFetch<UserProfileResponse>('/auth/me');
  if (!profile.success || !profile.data) redirect('/login');
  if (profile.data.role !== 'TRAVELER') redirect('/guide');

  return (
    <QueryProvider>
      <TravelerView userId={profile.data.id} />
    </QueryProvider>
  );
}
