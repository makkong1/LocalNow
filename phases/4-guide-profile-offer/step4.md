# Step 4: mobile-guide-profile-view

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/UI_GUIDE.md`
- `/mobile/src/types/api.ts` (Step 3에서 추가된 PublicProfileResponse 포함)
- `/mobile/src/lib/api-client.ts` (Step 3에서 추가된 getPublicProfile 포함)
- `/mobile/src/navigation/AppNavigator.tsx` (네비게이션 파라미터 타입 확인)
- `/mobile/src/screens/ChatScreen.tsx` (기존 화면 스타일 참고)
- `/mobile/src/components/GuideOfferCard.tsx` (가이드 오퍼 카드 구조 파악)

이전 step에서 추가된 `PublicProfileResponse` 타입과 `getPublicProfile()` 함수를 사용한다.

## 작업

여행자가 가이드의 전체 프로필을 볼 수 있는 읽기 전용 화면을 만든다. 이 화면은 가이드가 자신의 프로필을 볼 때도 사용한다.

### 1. usePublicProfile 훅 신설

`/mobile/src/hooks/usePublicProfile.ts`:

```typescript
export function usePublicProfile(userId: number): UseQueryResult<PublicProfileResponse>
```

- 쿼리 키: `['publicProfile', userId]`
- `api-client.ts`의 `getPublicProfile(userId)` 호출
- `staleTime: 5 * 60 * 1000` (5분, 프로필은 자주 바뀌지 않음)

### 2. GuideProfileScreen 신설

`/mobile/src/screens/GuideProfileScreen.tsx`:

네비게이션 파라미터: `{ userId: number }`

화면 구성 (ScrollView, 다크 테마):

**헤더 섹션**
- 프로필 이미지 원형 (80×80), 없으면 이니셜
- 이름 (굵게)
- 나이: `birthYear`가 있으면 `현재연도 - birthYear`로 계산하여 "만 N세" 표시, 없으면 미표시
- 평점 별점 표시 (avgRating, ratingCount)
- 완료한 서비스 수: "N회 완료"

**자기소개 섹션**
- `bio`가 있으면 표시, 없으면 섹션 숨김

**언어 능력 섹션**
- `languages` 배열을 뱃지(pill) 형태로 나열
- 뱃지 색: amber 계열

**자격증 섹션**
- 자격증이 있으면 목록 표시 (아이콘 + 이름 + "PDF" 레이블)
- 자격증이 하나라도 있으면 헤더 옆에 "인증됨" 뱃지 표시 (green)
- 자격증이 없으면: "등록된 자격증 없음" 회색 텍스트

**후기 섹션**
- `recentReviews` 최근 5개 표시
- 각 후기: 별점 + 코멘트 + 날짜
- 후기가 없으면: "아직 후기가 없습니다" 회색 텍스트

### 3. 네비게이션 파라미터 타입 추가

`/mobile/src/navigation/AppNavigator.tsx`에 `GuideProfileScreen` 추가:

```typescript
type AppStackParamList = {
  // 기존 ...
  GuideProfile: { userId: number };
};
```

스택 네비게이터에 `GuideProfileScreen` 등록.

## Acceptance Criteria

```bash
cd mobile && npm run lint   # 에러 없음
cd mobile && npm test       # 기존 테스트 통과
```

## 검증 절차

1. lint + test 실행 결과 확인
2. 체크리스트:
   - `GuideProfileScreen`이 `userId` 파라미터로 동작하는가?
   - 로딩 중 스켈레톤/스피너가 있는가?
   - `birthYear` 없을 때 나이 섹션이 안 보이는가?
   - 자격증 없을 때 "인증됨" 뱃지가 없는가?
   - `PublicProfileResponse`를 컴포넌트 내에서 재정의하지 않고 `types/api.ts`의 타입을 사용하는가?
3. 결과에 따라 `phases/4-guide-profile-offer/index.json` 해당 step 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "GuideProfileScreen(프로필+자격증인증뱃지+후기), usePublicProfile 훅 완료"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러"`

## 금지사항

- 컴포넌트 안에서 임시 인터페이스를 재정의하지 마라. 이유: CLAUDE.md CRITICAL 규칙 — 타입은 `types/api.ts`에서만 정의한다.
- PDF 자격증 파일을 앱 내부 WebView로 열려 하지 마라. 이유: 이 phase에서 PDF 뷰어는 범위 밖이다. 자격증 이름만 표시한다.
- 나이를 서버에서 계산해 받지 마라. `birthYear`를 클라이언트에서 계산한다. 이유: 서버가 현재 날짜 의존성을 갖지 않도록.
