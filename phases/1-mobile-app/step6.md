# Step 6: payment-review

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/API_CONVENTIONS.md`
- `/docs/ADR.md` (ADR-005: Mock PG)
- `/backend/src/main/java/com/localnow/payment/domain/PaymentIntent.java`
- `/backend/src/main/java/com/localnow/payment/domain/PaymentStatus.java`
- `/backend/src/main/java/com/localnow/review/domain/Review.java`
- `/mobile/src/types/api.ts`
- `/mobile/src/hooks/usePayment.ts`
- `/mobile/src/hooks/useReview.ts`
- `/mobile/src/screens/TravelerScreen.tsx`

## 작업

결제 플로우와 리뷰 작성을 완성한다. Mock PG 를 사용하므로 외부 결제 UI 없이 버튼 하나로 처리한다.

### 1. `mobile/src/screens/PaymentScreen.tsx`

결제 확인 화면:
```typescript
interface PaymentScreenProps {
  route: { params: { requestId: number; guideId: number } }
}
```
- `useCreatePaymentIntent()` 로 결제 의도 생성 (requestId 기반).
- 결제 의도 생성 후 금액 내역 표시:
  - 총 금액 (`amountKrw`)
  - 플랫폼 수수료 (`platformFeeKrw`)
  - 가이드 수령액 (`guidePayout`)
  - 요청 유형 (EMERGENCY 는 25% 수수료 강조 표시)
- "결제 완료 (Mock)" 버튼 → `useCapturePayment().mutate()`.
- 캡처 성공 시 `navigation.replace('Review', { requestId, guideId })` 로 전환.
- 이미 CAPTURED 상태이면 "이미 결제 완료" 표시.

### 2. `mobile/src/screens/ReviewScreen.tsx`

리뷰 작성 화면:
```typescript
interface ReviewScreenProps {
  route: { params: { requestId: number; guideId: number } }
}
```
- `ReviewForm` 컴포넌트 사용 (step 3 에서 구현).
- 제출 성공 시 `navigation.navigate('Traveler')` 로 이동.
- 현재 백엔드에는 요청별 리뷰 조회 API가 없으므로 사전 조회로 중복 작성 여부를 판단하지 않는다.
- 중복 제출 등 서버가 거절한 경우 `ApiError.message` 를 폼 하단에 표시한다.
- 리뷰 제출 성공 후에는 로컬 state 로 "리뷰를 작성하셨습니다. 감사합니다." 메시지를 표시하고 Traveler 탭으로 돌아갈 수 있게 한다.

### 3. `AppNavigator` 에 결제/리뷰 화면 등록

`AppNavigator.tsx` 를 Stack + Tab 혼합 구조로 전환:
- Bottom Tab 위에 Stack 을 두어 `PaymentScreen`, `ReviewScreen` 은 모달처럼 fullscreen Stack 으로 표시.
- `TravelerScreen` → "결제하기" 버튼 → 확정 오퍼에서 `guideId` 를 확인한 뒤 `navigation.navigate('Payment', { requestId, guideId })`.
- `PaymentScreen` → 결제 완료 → `navigation.navigate('Review', { requestId, guideId })`.

### 4. 결제 상태 표시

`TravelerScreen` MATCHED/IN_PROGRESS 상태:
- `PaymentStatus` 에 따라 버튼 변화:
  - 결제 의도 없음 → "결제하기" 버튼 활성
  - AUTHORIZED → "결제 대기중"
  - CAPTURED → "결제 완료 ✓" (비활성)
  - REFUNDED → "환불됨"
  - FAILED → "결제 실패 — 다시 시도"

### 5. 전체 플로우 통합 검증

이 step 에서 0-mvp 와 동등한 모바일 MVP 플로우가 완성되어야 한다:

```
로그인(여행자) → TravelerScreen → RequestForm 제출
→ 가이드 온듀티 → GuideScreen 에서 요청 카드 수신
→ 수락 → TravelerScreen 에서 GuideOfferCard 노출
→ 확정 → ChatScreen 에서 메시지 교환
→ PaymentScreen 에서 Mock 결제
→ ReviewScreen 에서 리뷰 제출
```

### 6. 테스트

`mobile/src/__tests__/PaymentScreen.test.tsx`:
- 결제 의도 생성 성공 시 금액 내역이 표시된다.
- "결제 완료" 버튼 클릭 시 `useCapturePayment().mutate()` 가 호출된다.
- CAPTURED 상태이면 버튼이 비활성화된다.

`mobile/src/__tests__/ReviewScreen.test.tsx`:
- 별점 없이 제출 버튼 클릭 불가.
- 리뷰 제출 성공 시 완료 메시지가 표시된다.
- 서버가 에러를 반환하면 에러 메시지가 표시된다.

## Acceptance Criteria

```bash
cd mobile && npm test     # 전체 테스트 통과
cd mobile && npm run lint # 에러 0
cd backend && ./gradlew check # 백엔드 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `PaymentScreen` 이 외부 PG SDK 를 호출하지 않고 백엔드 Mock API 만 호출하는가?
   - 결제 금액이 `number` (정수) 타입으로 처리되는가? (`Double` 금지, ADR-005 / API_CONVENTIONS 계약)
   - `ReviewScreen` 이 백엔드 에러를 사용자에게 표시하고 성공 시 중복 제출을 막는가?
3. 전체 플로우 수동 시뮬레이터 검증 (선택):
   - 두 시뮬레이터에서 위 "전체 플로우 통합 검증" 시나리오를 처음부터 끝까지 실행.
4. `phases/1-mobile-app/index.json` step 6 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "payment-review 완성. 전체 모바일 MVP 플로우(로그인 → 요청 → 수락 → 확정 → 채팅 → 결제 → 리뷰) 동작 확인."`

## 금지사항

- 실제 PG SDK (Toss, KG이니시스, Stripe 등) 를 설치하지 마라. 이유: 가맹점 등록, KYC, 콜백 URL 설정이 필요하며 harness 를 blocked 상태로 만든다 (ADR-005).
- 결제 금액을 `0.15 * amount` 같은 부동소수점 연산으로 계산하지 마라. 이유: 백엔드가 정수 연산으로 수수료를 계산해 반환한다. 모바일은 반환값을 그대로 표시한다.
- 리뷰 작성 후 요청 상태가 COMPLETED 로 전환되지 않는다고 가정하지 마라. 이유: 백엔드에서 캡처 시 COMPLETED 로 전환한다. 리뷰 여부는 별도 API 로 확인.
