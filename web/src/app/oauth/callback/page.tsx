import { OAuthCallbackClient } from './OAuthCallbackClient';

export default function OAuthCallbackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[#0a0a0a]">
      <div className="w-full max-w-sm rounded-lg border border-neutral-800 bg-[#141414] p-6">
        <h1 className="text-base font-medium text-white mb-4">로그인</h1>
        <OAuthCallbackClient />
      </div>
    </main>
  );
}
