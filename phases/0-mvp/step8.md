# Step 8: web-foundation

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/API_CONVENTIONS.md`
- `/docs/ADR.md` (ADR-007, ADR-009: BFF + HttpOnly 쿠키)
- `/docs/UI_GUIDE.md`
- `/backend/src/main/java/com/localnow/common/ErrorCode.java`
- `/web/package.json`
- `/web/next.config.ts`

이전 step들에서 확정된 백엔드 API 계약(API_CONVENTIONS.md)과 보안 설계(ADR-009)를 먼저 읽고, 웹의 BFF 구조를 파악한 뒤 작업하라.

## 작업

웹의 기반 레이어: 타입 정의, 공통 유틸, 인증 Route Handler, 로그인/회원가입 페이지를 만든다.
이 step 이후에는 `npm run build`가 항상 통과해야 한다.

### 1. `web/src/types/api.ts`

`docs/API_CONVENTIONS.md`의 계약과 1:1 대응하는 TypeScript 타입을 **모두** 정의한다.
컴포넌트 안에서 임시 타입을 재정의하지 않는다.

포함해야 할 타입:
```typescript
// 공통 봉투
interface ApiResponse<T> { success: boolean; data: T | null; error: ApiError | null; meta: { requestId: string }; }
interface ApiError { code: ErrorCode; message: string; fields: FieldError[] | null; }
interface FieldError { field: string; message: string; }
type ErrorCode = 'AUTH_UNAUTHENTICATED' | 'AUTH_FORBIDDEN' | 'VALIDATION_FAILED' |
                 'REQUEST_NOT_FOUND' | 'REQUEST_NOT_OPEN' | 'MATCH_ALREADY_CONFIRMED' |
                 'PAYMENT_INVALID_STATE' | 'RATE_LIMITED' | 'INTERNAL_ERROR';

// 도메인 타입
type UserRole = 'TRAVELER' | 'GUIDE';
type RequestType = 'GUIDE' | 'TRANSLATION' | 'FOOD' | 'EMERGENCY';
type HelpRequestStatus = 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type PaymentStatus = 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED';
type MatchOfferStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

interface AuthResponse { accessToken: string; userId: number; role: UserRole; name: string; }
interface UserProfileResponse { id: number; email: string; name: string; role: UserRole; languages: string[]; city: string; avgRating: number; ratingCount: number; }
interface HelpRequestResponse { id: number; travelerId: number; requestType: RequestType; lat: number; lng: number; description: string; startAt: string; durationMin: number; budgetKrw: number; status: HelpRequestStatus; createdAt: string; }
interface MatchOfferResponse { id: number; requestId: number; guideId: number; guideName: string; guideAvgRating: number; status: MatchOfferStatus; message: string | null; createdAt: string; }
interface ChatRoomResponse { id: number; requestId: number; travelerId: number; guideId: number; createdAt: string; }
interface ChatMessageResponse { messageId: number; roomId: number; senderId: number; content: string; sentAt: string; clientMessageId: string; }
interface PaymentIntentResponse { id: number; requestId: number; amountKrw: number; platformFeeKrw: number; guidePayout: number; status: PaymentStatus; createdAt: string; }
interface ReviewResponse { id: number; requestId: number; revieweeId: number; rating: number; comment: string | null; createdAt: string; }

// STOMP push 이벤트
type StompEvent =
  | { type: 'NEW_REQUEST'; requestId: number; requestType: RequestType; budgetKrw: number; }
  | { type: 'OFFER_ACCEPTED'; guideId: number; }
  | { type: 'MATCH_CONFIRMED'; requestId: number; }
  | { type: 'CHAT_MESSAGE'; roomId: number; preview: string; };
```

### 2. `web/src/lib/`

#### `env.ts`
`process.env.BACKEND_BASE_URL`을 읽어 검증. 없으면 throw. 브라우저 번들에 노출되지 않도록 `server-only` 패키지 import.

#### `cookies.ts`
- `getAuthToken(): string | undefined` — Next.js `cookies()` API로 HttpOnly 쿠키 `auth_token` 읽기 (서버 전용).
- `setAuthToken(token: string, res: NextResponse)` — `auth_token` HttpOnly Secure SameSite=Lax 쿠키 세팅.
- `clearAuthToken(res: NextResponse)` — 쿠키 제거.

#### `api-client.ts`
서버 컴포넌트 / Route Handler 에서 사용하는 fetch 래퍼. 브라우저 직접 호출 금지.
```typescript
async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>>
// 내부: BACKEND_BASE_URL + path, Authorization: Bearer <token from cookies>
// 에러 시 ApiResponse 봉투 형식으로 일관되게 반환
```

### 3. 인증 Route Handler (`web/src/app/api/auth/`)

#### `POST /api/auth/login` → `app/api/auth/login/route.ts`
- body: `{ email, password }` → 백엔드 `POST /auth/login` 프록시.
- 성공 시 응답의 `accessToken`을 HttpOnly 쿠키에 저장하고 `AuthResponse` 반환.
- 실패 시 백엔드 에러를 그대로 전달.

#### `POST /api/auth/signup` → `app/api/auth/signup/route.ts`
- 백엔드 `POST /auth/signup` 프록시.

#### `POST /api/auth/logout` → `app/api/auth/logout/route.ts`
- `auth_token` 쿠키 삭제 후 200 반환.

#### `GET /api/auth/me` → `app/api/auth/me/route.ts`
- 백엔드 `GET /auth/me` 프록시.

### 4. 나머지 Route Handler 스텁 (빌드 통과용)

아직 구현하지 않아도 되지만, 타입 에러 없이 빌드되어야 한다.
각 Route Handler는 `NextResponse.json({ message: 'not implemented' }, { status: 501 })`만 반환하는 스텁으로 만든다.

- `app/api/requests/route.ts` (GET, POST)
- `app/api/requests/[id]/route.ts` (GET)
- `app/api/requests/[id]/accept/route.ts` (POST)
- `app/api/requests/[id]/confirm/route.ts` (POST)
- `app/api/requests/[id]/offers/route.ts` (GET)
- `app/api/requests/[id]/room/route.ts` (GET)
- `app/api/requests/[id]/review/route.ts` (POST)
- `app/api/rooms/[id]/messages/route.ts` (GET)
- `app/api/payments/intent/route.ts` (POST)
- `app/api/payments/[requestId]/capture/route.ts` (POST)
- `app/api/guide/duty/route.ts` (POST)
- `app/api/chat/socket-token/route.ts` (GET)

### 5. 인증 페이지

#### `app/login/page.tsx` (Server Component)
- 로그인된 사용자면 role에 따라 `/traveler` 또는 `/guide`로 redirect.
- `<LoginForm />` Client Component를 렌더.

#### `app/signup/page.tsx` (Server Component)
- `<SignupForm />` Client Component를 렌더.

#### `components/client/LoginForm.tsx`
- `"use client"` 선언.
- `email`, `password` 입력 → `POST /api/auth/login` → 성공 시 `router.push('/traveler' or '/guide')`.
- UI_GUIDE.md 컴포넌트 스타일 적용 (입력 필드, Primary 버튼).
- AI 슬롭 안티패턴(backdrop-blur, gradient, glow) 사용 금지.

#### `components/client/SignupForm.tsx`
- `email`, `password`, `name`, `role`(TRAVELER|GUIDE 선택), `city` 입력 → `POST /api/auth/signup`.

### 6. 레이아웃

#### `app/layout.tsx` (최종 버전)
- 공통 헤더: 로고(`LocalNow`), 현재 사용자 이름 + 역할 (서버에서 쿠키로 프로필 읽기), 로그아웃 버튼.
- 데스크톱 1280px 기준, `min-w-[1024px]`.
- 그 이하 화면: "시연은 데스크톱(1280px 이상)에서 확인해주세요" 배너.

### 7. 테스트

`app/api/auth/__tests__/login.test.ts` (Vitest, fetch mocking):
- 정상: 로그인 성공 → 쿠키 설정 확인
- 예외: 잘못된 자격증명 → 401 에러 전달

## Acceptance Criteria

```bash
cd web && npm run lint && npm run build
```

TypeScript 에러, lint 에러 모두 0.

## 검증 절차

1. `npm run lint && npm run build` 실행.
2. 체크리스트:
   - `types/api.ts`가 `API_CONVENTIONS.md`의 모든 타입을 커버하는가?
   - Route Handler가 `auth_token`을 HttpOnly 쿠키로 설정하는가?
   - `api-client.ts`에 `server-only` import가 있어 클라이언트 번들에 포함되지 않는가?
   - UI_GUIDE.md 금지 패턴(backdrop-blur, gradient-text, glow)이 없는가?
3. `phases/0-mvp/index.json` step 8 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "web 기반 레이어(types/api.ts 전체 타입, lib/api-client+cookies+env, 인증 Route Handler, 로그인/회원가입 페이지, 나머지 Route Handler 스텁) 완료. npm run lint && npm run build 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- 브라우저 컴포넌트에서 `BACKEND_BASE_URL` 환경변수를 직접 읽지 마라. 이유: API URL이 클라이언트 번들에 노출된다. `env.ts`는 `server-only`로 보호한다.
- `localStorage`에 JWT를 저장하지 마라. 이유: XSS로 토큰 탈취 가능. HttpOnly 쿠키만 사용 (ADR-009).
- 컴포넌트 파일 안에서 API 타입을 임시 인터페이스로 재정의하지 마라. 이유: `types/api.ts` 단일 소스 원칙.
- 기존 테스트를 깨뜨리지 마라.
