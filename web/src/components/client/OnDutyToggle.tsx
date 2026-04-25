'use client';

import { useState } from 'react';

interface Props {
  initialOnDuty: boolean;
}

export default function OnDutyToggle({ initialOnDuty }: Props) {
  const [onDuty, setOnDuty] = useState(initialOnDuty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    const next = !onDuty;

    if (next) {
      setLoading(true);
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      ).catch(() => null);

      if (!position) {
        setError('위치 정보를 가져올 수 없습니다. 브라우저 위치 권한을 허용해주세요.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/guide/duty', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            onDuty: true,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        });
        if (!res.ok) throw new Error('서버 오류');
        setOnDuty(true);
      } catch {
        setError('근무 상태 변경에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        await fetch('/api/guide/duty', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onDuty: false }),
        });
        setOnDuty(false);
      } catch {
        setError('근무 상태 변경에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={loading}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            onDuty ? 'bg-amber-500' : 'bg-neutral-700'
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              onDuty ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${onDuty ? 'text-amber-500' : 'text-neutral-400'}`}>
          {loading ? '변경 중...' : onDuty ? '근무 중' : '오프라인'}
        </span>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
