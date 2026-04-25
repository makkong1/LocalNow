import type { ApiError } from '@/types/api';

/** DTO / JSON 필드명 → 한글 라벨 (화면에만 사용) */
const FIELD_LABELS: Record<string, string> = {
  email: '이메일',
  password: '비밀번호',
  name: '이름',
  role: '역할',
  city: '도시',
  languages: '사용 언어',
  rating: '평점',
  comment: '코멘트',
  content: '내용',
  clientMessageId: '메시지 ID',
};

export function fieldLabelFor(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** 검증/일반 API 오류를 한 줄로 합쳐 표시할 때 (토스트 등) */
export function formatApiErrorText(error: ApiError | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.fields?.length) {
    return error.fields.map((f) => `${fieldLabelFor(f.field)}: ${f.message}`).join(' · ');
  }
  return error.message?.trim() ? error.message : fallback;
}
