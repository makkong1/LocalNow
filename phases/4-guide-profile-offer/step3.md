# Step 3: mobile-profile-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/UI_GUIDE.md`
- `/docs/API_CONVENTIONS.md`
- `/mobile/src/types/api.ts`
- `/mobile/src/lib/api-client.ts`
- `/mobile/src/navigation/AppNavigator.tsx`
- `/mobile/src/screens/LoginScreen.tsx` (기존 화면 스타일 참고)
- `/mobile/src/screens/SignupScreen.tsx` (폼 입력 패턴 참고)
- `/mobile/package.json` (기존 의존성 확인)

이전 step들에서 백엔드에 추가된 API (`POST /users/profile-image`, `POST /guide/certifications`, `GET /guide/certifications`, `DELETE /guide/certifications/{id}`)를 사용한다.

## 작업

가이드/여행자 모두 프로필 이미지를 업로드할 수 있고, 가이드는 추가로 자격증 PDF를 관리할 수 있는 설정 화면을 만든다.

### 1. 의존성 설치

```bash
cd mobile
npx expo install expo-image-picker expo-document-picker
```

### 2. api.ts 타입 추가

`/mobile/src/types/api.ts`에 추가:

```typescript
export interface CertificationResponse {
  id: number;
  name: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface PublicProfileResponse {
  id: number;
  name: string;
  profileImageUrl: string | null;
  birthYear: number | null;
  bio: string | null;
  role: UserRole;
  languages: string[];
  avgRating: number;
  ratingCount: number;
  completedCount: number;        // 가이드만 의미 있음, 여행자는 0
  certifications: CertificationResponse[];
  recentReviews: ReviewResponse[];
}
```

기존 `UserProfileResponse`에도 추가:
```typescript
profileImageUrl: string | null;
birthYear: number | null;
bio: string | null;
```

### 3. api-client.ts 함수 추가

`/mobile/src/lib/api-client.ts`에 추가:

```typescript
// 프로필 이미지 업로드 (여행자/가이드 공통)
uploadProfileImage(imageUri: string): Promise<UserProfileResponse>

// 공개 프로필 조회
getPublicProfile(userId: number): Promise<PublicProfileResponse>

// 가이드 자격증 목록 조회
getMyCertifications(): Promise<CertificationResponse[]>

// 가이드 자격증 업로드
uploadCertification(name: string, fileUri: string): Promise<CertificationResponse>

// 가이드 자격증 삭제
deleteCertification(certId: number): Promise<void>
```

`uploadProfileImage`와 `uploadCertification`은 `FormData`를 사용해 multipart/form-data로 전송한다:
```typescript
const formData = new FormData();
formData.append('file', { uri, name: 'file.jpg', type: 'image/jpeg' } as any);
```

### 4. 훅(hooks) 추가

`/mobile/src/hooks/useProfileSetup.ts` 신설:

```typescript
export function useUpdateProfileImage(): UseMutationResult<...>
export function useUploadCertification(): UseMutationResult<...>
export function useDeleteCertification(): UseMutationResult<...>
export function useMyCertifications(): UseQueryResult<CertificationResponse[]>
```

- `useUpdateProfileImage` 성공 시 `queryClient.invalidateQueries(['auth', 'me'])` 호출
- `useUploadCertification` 성공 시 `queryClient.invalidateQueries(['certifications', 'mine'])` 호출
- `useDeleteCertification` 성공 시 동일하게 인밸리데이션

### 5. ProfileEditScreen 화면 신설

`/mobile/src/screens/ProfileEditScreen.tsx`:

화면 구조 (ScrollView):
1. **프로필 이미지 섹션**: 현재 이미지 원형 표시 → 탭 시 `expo-image-picker`로 갤러리 열기 → 선택 즉시 업로드
2. **기본 정보 섹션**: 이름(읽기 전용), 생년도 입력(TextInput, 숫자), 자기소개(TextInput, 여러 줄)
3. **자격증 섹션 (GUIDE만 렌더)**: 
   - 기존 자격증 목록 (이름 + 삭제 버튼)
   - "자격증 추가" 버튼 → 이름 입력 후 `expo-document-picker`로 PDF 선택 → 업로드

디자인 규칙 (`docs/UI_GUIDE.md` 준수):
- 다크 배경, amber/orange 포인트 색상
- 프로필 이미지 자리: 80×80 원형, 기본 이미지는 이니셜 텍스트로 대체
- 자격증이 없는 가이드는 섹션 하단에 회색 안내 문구: "자격증을 등록하면 여행자의 신뢰도가 높아집니다"

### 6. 네비게이션 연결

`/mobile/src/navigation/AppNavigator.tsx`에 `ProfileEditScreen` 추가.

각 탭의 헤더(또는 기존 프로필 버튼)에서 `ProfileEditScreen`으로 이동할 수 있도록 연결.

## Acceptance Criteria

```bash
cd mobile && npm run lint   # 에러 없음
cd mobile && npm test       # 기존 테스트 통과
```

## 검증 절차

1. lint + test 실행 결과 확인
2. 체크리스트:
   - `api.ts`에 `PublicProfileResponse`, `CertificationResponse` 타입이 있는가?
   - `api-client.ts`에서 컴포넌트가 직접 `fetch`를 호출하지 않는가?
   - JWT는 `expo-secure-store`에서만 읽는가?
   - `expo-image-picker`, `expo-document-picker`가 `package.json`에 추가되었는가?
3. 결과에 따라 `phases/4-guide-profile-offer/index.json` 해당 step 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "ProfileEditScreen(이미지업로드+자격증관리), useProfileSetup 훅, api.ts 타입 확장 완료"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러"`

## 금지사항

- 컴포넌트 내부에서 `fetch`나 `axios`를 직접 호출하지 마라. 이유: CLAUDE.md CRITICAL 규칙 — 모든 API 호출은 `api-client.ts`를 통해야 한다.
- JWT 토큰을 `AsyncStorage`나 전역 변수에 저장하지 마라. 이유: `expo-secure-store`만 사용.
- `expo-document-picker`로 선택한 파일의 URI를 직접 `<Image>`에 사용하지 마라. 이유: PDF는 이미지가 아니다. 이름만 표시한다.
- 가이드 전용 자격증 섹션을 여행자에게도 렌더하지 마라. `useAuth()`의 `role`로 분기하라.
