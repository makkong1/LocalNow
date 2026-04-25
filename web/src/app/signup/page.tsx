import SignupForm from '@/components/client/SignupForm';

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-2">LocalNow</h1>
        <p className="text-sm text-neutral-400 mb-8">여행 중 실시간 현지 가이드 매칭</p>
        <div className="rounded-lg bg-[#141414] border border-neutral-800 p-6">
          <h2 className="text-base font-medium text-white mb-6">회원가입</h2>
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
