'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { HelpRequestResponse, RequestType, ApiResponse } from '@/types/api';

interface Props {
  onSuccess: (request: HelpRequestResponse) => void;
}

interface RequestBody {
  requestType: RequestType;
  description: string;
  startAt: string;
  durationMin: number;
  budgetKrw: number;
  lat: number;
  lng: number;
}

const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };

export default function RequestForm({ onSuccess }: Props) {
  const [form, setForm] = useState({
    requestType: 'GUIDE' as RequestType,
    description: '',
    startAt: '',
    durationMin: 60,
    budgetKrw: 30000,
  });

  const mutation = useMutation({
    mutationFn: async (body: RequestBody) => {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: ApiResponse<HelpRequestResponse> = await res.json();
      if (!data.success || !data.data) throw new Error(data.error?.message ?? '요청 실패');
      return data.data;
    },
    onSuccess,
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'durationMin' || name === 'budgetKrw' ? parseInt(value, 10) || 0 : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    }).catch(() => null);

    const lat = position?.coords.latitude ?? SEOUL_CITY_HALL.lat;
    const lng = position?.coords.longitude ?? SEOUL_CITY_HALL.lng;

    mutation.mutate({ ...form, lat, lng });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">도움 요청</h2>

      <div>
        <label className="block text-xs text-neutral-400 mb-1">유형</label>
        <select
          name="requestType"
          value={form.requestType}
          onChange={handleChange}
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
        >
          <option value="GUIDE">가이드</option>
          <option value="TRANSLATION">통역</option>
          <option value="FOOD">음식</option>
          <option value="EMERGENCY">긴급</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-neutral-400 mb-1">설명</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={2}
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 resize-none"
          placeholder="어떤 도움이 필요하신가요?"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-neutral-400 mb-1">시작 시간</label>
          <input
            type="datetime-local"
            name="startAt"
            value={form.startAt}
            onChange={handleChange}
            required
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1">소요시간(분)</label>
          <input
            type="number"
            name="durationMin"
            value={form.durationMin}
            onChange={handleChange}
            min={10}
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-400 mb-1">예산(원)</label>
        <input
          type="number"
          name="budgetKrw"
          value={form.budgetKrw}
          onChange={handleChange}
          min={0}
          step={1000}
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      {mutation.error && (
        <p className="text-xs text-red-400">{(mutation.error as Error).message}</p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-md bg-amber-500 text-black font-medium px-4 py-2 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-sm"
      >
        {mutation.isPending ? '요청 중...' : '도움 요청하기'}
      </button>
    </form>
  );
}
