'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md bg-neutral-800 text-white px-4 py-2 hover:bg-neutral-700 text-sm"
    >
      로그아웃
    </button>
  );
}
