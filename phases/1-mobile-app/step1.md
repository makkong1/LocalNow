# Step 1: auth-flow

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (모바일 섹션)
- `/docs/ADR.md` (ADR-011: expo-secure-store, ADR-012: 백엔드 직접 호출)
- `/docs/API_CONVENTIONS.md`
- `/backend/src/main/java/com/localnow/user/dto/LoginRequest.java`
- `/backend/src/main/java/com/localnow/user/dto/SignupRequest.java`
- `/backend/src/main/java/com/localnow/user/dto/AuthResponse.java`
- `/mobile/src/types/api.ts` (step 0 에서 생성한 빈 파일)
- `/mobile/src/lib/secure-storage.ts`
- `/mobile/src/lib/api-client.ts`

## 작업

인증 흐름을 구현한다: 로그인, 회원가입, 인증 상태에 따른 네비게이션 분기, 자동 로그인(앱 시작 시 토큰 확인).
인증 상태는 단순 hook 내부 state 로 흩어지지 않도록 `AuthProvider` + `useAuth()` Context 구조로 만든다.

### 1. `mobile/src/types/api.ts`

`docs/API_CONVENTIONS.md` 계약과 1:1 대응하는 TypeScript 타입을 정의한다.
`web/src/types/api.ts` 와 동일한 계약을 따르되, Next.js 관련 타입은 제외한다.

포함해야 할 타입:
```typescript
interface ApiResponse<T> { success: boolean; data: T | null; error: ApiError | null; meta: { requestId: string }; }
interface ApiError { code: ErrorCode; message: string; fields: FieldError[] | null; }
interface FieldError { field: string; message: string; }
type ErrorCode = 'AUTH_UNAUTHENTICATED' | 'AUTH_FORBIDDEN' | 'VALIDATION_FAILED' |
                 'REQUEST_NOT_FOUND' | 'REQUEST_NOT_OPEN' | 'MATCH_ALREADY_CONFIRMED' |
                 'PAYMENT_INVALID_STATE' | 'RATE_LIMITED' | 'INTERNAL_ERROR';
type UserRole = 'TRAVELER' | 'GUIDE';
type RequestType = 'GUIDE' | 'TRANSLATION' | 'FOOD' | 'EMERGENCY';
type HelpRequestStatus = 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type PaymentStatus = 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED';
type MatchOfferStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
interface AuthResponse { accessToken: string; userId: number; role: UserRole; name: string; }
interface UserProfileResponse { id: number; email: string; name: string; role: UserRole; languages: string[]; city: string; avgRating: number; ratingCount: number; }
interface SignupParams { email: string; password: string; name: string; role: UserRole; languages?: string[]; city?: string; }
// ... (이후 step 에서 추가되는 타입은 이 파일에 계속 추가)
```

### 2. `mobile/src/lib/secure-storage.ts`

`expo-secure-store` 래퍼:
```typescript
export async function getToken(): Promise<string | null>
export async function setToken(token: string): Promise<void>
export async function clearToken(): Promise<void>
export async function getUserId(): Promise<number | null>
export async function setUserId(id: number): Promise<void>
export async function getUserRole(): Promise<UserRole | null>
export async function setUserRole(role: UserRole): Promise<void>
```
- 키 이름은 `localnow_access_token`, `localnow_user_id`, `localnow_user_role` 로 고정.
- `SecureStore.setItemAsync` 옵션: `{ keychainAccessible: SecureStore.WHEN_UNLOCKED }`.

### 3. `mobile/src/lib/api-client.ts`

백엔드 직접 호출 fetch 래퍼:
```typescript
async function apiFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown; requiresAuth?: boolean }
): Promise<ApiResponse<T>>
```
- `EXPO_PUBLIC_API_BASE_URL` + path 로 호출.
- `requiresAuth: true` (기본값) 이면 `SecureStore` 에서 토큰을 읽어 `Authorization: Bearer <token>` 헤더 첨부.
- 응답이 `success: false` 이면 `ApiResponse` 를 그대로 반환 (throw 금지). 호출부가 분기하도록.
- 네트워크 에러 시 `{ success: false, data: null, error: { code: 'INTERNAL_ERROR', message: e.message, fields: null }, meta: { requestId: '' } }` 반환.

### 4. `mobile/src/hooks/useAuth.ts`

```typescript
interface AuthState {
  isLoading: boolean;   // 초기 토큰 확인 중
  isLoggedIn: boolean;
  userId: number | null;
  role: UserRole | null;
}

function useAuth(): AuthState & {
  login: (email: string, password: string) => Promise<ApiError | null>;
  signup: (params: SignupParams) => Promise<ApiError | null>;
  logout: () => Promise<void>;
}
```
- 같은 파일에서 `AuthProvider` 를 export 한다. 내부는 `createContext` + `useContext` 로 구현한다.
- `AuthProvider` 마운트 시 `SecureStore` 에서 토큰/userId/role 을 읽어 `isLoading` 을 false 로 전환.
- `useAuth()` 는 반드시 `AuthProvider` 내부에서만 호출되며, Provider 밖에서 호출되면 명확한 에러를 throw 한다.
- `login()`: `POST /auth/login` 호출 → 성공 시 토큰/userId/role 을 `SecureStore` 에 저장, 상태 갱신. 실패 시 `ApiError` 반환.
- `signup()`: `POST /auth/signup` 호출 → 성공 시 로그인 화면으로 돌아갈 수 있도록 `null` 반환. 자동 로그인은 하지 않는다.
- `logout()`: `SecureStore` 전체 삭제, 상태 초기화.

### 5. `mobile/App.tsx`

`QueryClientProvider` 와 `NavigationContainer` 사이 또는 안쪽에서 `AuthProvider` 로 앱을 감싼다:
```tsx
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  </AuthProvider>
</QueryClientProvider>
```

### 6. `mobile/src/navigation/RootNavigator.tsx`

```typescript
function RootNavigator()
```
- Context 기반 `useAuth()` 의 `isLoading` 이 true 이면 스플래시/로딩 화면.
- `isLoggedIn` 이 false 이면 `AuthNavigator` (로그인/회원가입).
- `isLoggedIn` 이 true 이면 `AppNavigator` (메인 앱).

### 7. `mobile/src/navigation/AuthNavigator.tsx`

Stack Navigator:
- `Login` → `LoginScreen`
- `Signup` → `SignupScreen`

### 8. `mobile/src/navigation/AppNavigator.tsx`

Bottom Tab Navigator:
- `Traveler` 탭 → `TravelerScreen` (역할이 TRAVELER 이거나 둘 다 접근 가능)
- `Guide` 탭 → `GuideScreen` (역할이 GUIDE 이거나 둘 다 접근 가능)
- `Chat` 탭 → `ChatScreen` (매칭 확정 후 활성화 - 우선 항상 노출)
- 헤더에 현재 사용자 이름 + 역할 표시. 로그아웃 버튼.

### 9. `mobile/src/screens/LoginScreen.tsx`

- 이메일, 비밀번호 입력 폼.
- `useAuth().login()` 호출 → 성공 시 RootNavigator 가 자동으로 AppNavigator 로 전환.
- 실패 시 에러 메시지를 폼 하단에 표시.
- "회원가입" 버튼 → `AuthNavigator` 의 Signup 화면으로 이동.

### 10. `mobile/src/screens/SignupScreen.tsx`

- 이메일, 비밀번호, 이름, 역할(TRAVELER/GUIDE 선택), 도시 입력 폼.
- `useAuth().signup()` 호출 → 성공 시 로그인 화면으로 이동.

### 11. 테스트

`mobile/src/__tests__/secure-storage.test.ts`:
- `setToken` → `getToken` 으로 같은 값 반환.
- `clearToken` 후 `getToken` 은 null.

`mobile/src/__tests__/LoginScreen.test.tsx`:
- 이메일/비밀번호 입력 후 버튼 클릭 시 `login` 함수가 호출된다.
- 에러 반환 시 에러 메시지가 화면에 표시된다.

`mobile/src/__tests__/useAuth.test.tsx`:
- `AuthProvider` 초기화 시 SecureStore 의 token/userId/role 을 읽고 로그인 상태를 복원한다.
- `logout()` 호출 시 SecureStore 값이 삭제되고 상태가 초기화된다.

## Acceptance Criteria

```bash
cd mobile && npm test     # 위 2개 테스트 통과
cd mobile && npm run lint # 에러 0
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `api-client.ts` 가 `AsyncStorage` 를 사용하지 않는가?
   - `useAuth` 가 Context 기반 Provider 로 구현되어 RootNavigator 와 화면 컴포넌트가 같은 인증 상태를 공유하는가?
   - `useAuth` 가 토큰을 상태 변수(메모리)에만 임시 보관하고 영속은 `secure-storage.ts` 에 위임하는가?
   - `LoginScreen` 이 `apiFetch` 를 직접 호출하지 않고 `useAuth.login()` 을 통하는가?
3. `phases/1-mobile-app/index.json` step 1 업데이트.

## 금지사항

- `AsyncStorage` 에 JWT 를 저장하지 마라. 이유: 평문 저장, 루팅/탈옥 기기에서 탈취 가능. `expo-secure-store` 만 허용 (ADR-011).
- 컴포넌트 안에서 `EXPO_PUBLIC_API_BASE_URL` 을 직접 읽지 마라. 이유: `api-client.ts` 가 단일 접점.
- `api-client.ts` 에서 401 수신 시 `throw` 하지 마라. 이유: 호출부가 에러 타입을 코드로 분기해야 한다. `ApiResponse` 를 그대로 반환.
- 기존 `backend/` 및 `web/` 코드를 수정하지 마라.
