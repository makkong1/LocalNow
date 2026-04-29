# Step 5: mobile-offer-accept-ux

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/UI_GUIDE.md`
- `/mobile/src/screens/TravelerScreen.tsx`
- `/mobile/src/components/GuideOfferCard.tsx`
- `/mobile/src/hooks/useConfirmGuide.ts` (또는 해당 훅이 정의된 파일)
- `/mobile/src/navigation/AppNavigator.tsx` (GuideProfile 라우트 확인)
- `/mobile/src/types/api.ts` (MatchOfferResponse, PublicProfileResponse 확인)

이전 step들에서 완성된 `GuideProfileScreen`과 `usePublicProfile` 훅을 사용한다.

## 작업

여행자가 가이드 오퍼를 받았을 때 두 가지 UX를 개선한다:
1. 오퍼 카드에서 가이드 프로필로 진입할 수 있게 한다
2. 가이드 선택 시 Yes/No 확인 프롬프트를 추가한다

### 1. GuideOfferCard 개선

`/mobile/src/components/GuideOfferCard.tsx` 수정:

**프로필 진입 연결**
- 카드 상단 영역(이름, 평점, 프로필 이미지)을 `TouchableOpacity`로 감싼다
- 탭 시 `navigation.navigate('GuideProfile', { userId: offer.guideId })` 호출
- "상세 보기 →" 텍스트 링크를 카드 우상단에 추가 (amber 색상)

**자격증 뱃지 추가**
- `MatchOfferResponse`에 `guideId`가 있으므로, `GuideOfferCard`가 `hasCertification` prop을 받도록 수정
- `hasCertification`이 true이면 카드 내 가이드 이름 옆에 "인증됨" 뱃지(green) 표시
- 여행자에게 자격증 보유 여부를 오퍼 목록에서 바로 확인할 수 있게 한다

**GuideOfferCard props 수정**:
```typescript
interface GuideOfferCardProps {
  offer: MatchOfferResponse;
  hasCertification: boolean;    // 신규 추가
  onConfirm: () => void;
  navigation: any;              // 네비게이션 prop
}
```

### 2. TravelerScreen의 오퍼 확정 UX 개선

`/mobile/src/screens/TravelerScreen.tsx` 수정:

**확인 프롬프트 추가**
- 현재: "확정" 버튼 탭 → 즉시 `useConfirmGuide()` 호출
- 변경: "확정" 버튼 탭 → `Alert.alert()` 프롬프트 표시

```typescript
Alert.alert(
  '가이드를 선택하시겠습니까?',
  `${offer.guideName} 가이드로 매칭을 확정합니다.`,
  [
    { text: '아니오', style: 'cancel' },
    {
      text: '예, 확정합니다',
      onPress: () => confirmGuide({ requestId, guideId: offer.guideId }),
    },
  ]
);
```

**hasCertification 데이터 연결**
- 오퍼 목록을 렌더할 때, 각 오퍼의 `guideId`로 `usePublicProfile(offer.guideId)`를 호출해 `certifications.length > 0` 여부를 `GuideOfferCard`에 전달
- 단, 오퍼가 여러 개일 경우 각각 별도 쿼리가 발생함 — TanStack Query가 캐싱하므로 허용

### 3. 매칭 확정 후 상태(MatchedView) 개선

TravelerScreen의 MATCHED 상태 뷰에서:
- 확정된 가이드의 이름 + 평점을 표시하는 기존 영역에 "프로필 보기" 링크 추가
- 탭 시 `GuideProfileScreen`으로 이동

## Acceptance Criteria

```bash
cd mobile && npm run lint   # 에러 없음
cd mobile && npm test       # 기존 테스트 통과
```

## 검증 절차

1. lint + test 실행 결과 확인
2. 체크리스트:
   - 가이드 이름 탭 → `GuideProfileScreen`으로 이동하는가?
   - "확정" 버튼 → Alert 프롬프트 → "예" 선택 → 확정 API 호출 순서인가?
   - "아니오" 선택 시 아무 일도 일어나지 않는가?
   - 자격증 있는 가이드 오퍼 카드에 "인증됨" 뱃지가 표시되는가?
   - `usePublicProfile` 결과가 없을 때(로딩 중) `hasCertification`을 false로 처리하는가?
3. 결과에 따라 `phases/4-guide-profile-offer/index.json` 해당 step 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "GuideOfferCard 프로필 진입+인증뱃지, 오퍼 확정 Yes/No Alert 프롬프트, MatchedView 프로필 링크 완료"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러"`

## 금지사항

- 확인 프롬프트를 커스텀 Modal로 만들지 마라. 이유: RN의 `Alert.alert()`으로 충분하다. 커스텀 Modal은 불필요한 복잡도다.
- 오퍼 목록 렌더 시 `usePublicProfile`을 기다리느라 오퍼 카드 렌더를 블로킹하지 마라. 이유: 자격증 뱃지는 부가 정보이므로 로딩 중엔 뱃지 없이 카드를 먼저 보여준다.
- `GuideOfferCard`에 네비게이션 로직을 직접 구현하지 마라. `onPressProfile` 콜백 prop으로 부모(TravelerScreen)에서 처리하라. 이유: 컴포넌트 재사용성 유지.
