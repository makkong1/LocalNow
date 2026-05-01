# Step 1: mobile-capture-guard

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/Users/maknkkong/project/localNow/CLAUDE.md`
- `/Users/maknkkong/project/localNow/docs/UI_GUIDE.md`
- `/Users/maknkkong/project/localNow/mobile/src/screens/PaymentScreen.tsx`
- `/Users/maknkkong/project/localNow/mobile/src/__tests__/PaymentScreen.test.tsx`
- `/Users/maknkkong/project/localNow/mobile/src/types/api.ts`
- `/Users/maknkkong/project/localNow/mobile/src/hooks/useRequests.ts`

이전 step 0에서 변경된 파일:
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/payment/service/PaymentService.java`

## 배경

백엔드(step 0)에서 `capture`는 `HelpRequest.status == IN_PROGRESS`일 때만 허용하도록 변경됐다.
`MATCHED` 상태(가이드가 아직 서비스를 시작하지 않은 상태)에서 캡처를 시도하면 백엔드가 409를 반환한다.

모바일 `PaymentScreen.tsx`에는 이미 capture 버튼이 있지만, `request.status`를 확인하지 않아 `MATCHED` 상태에서도 버튼이 활성화되어 있다. 사용자가 이 버튼을 누르면 백엔드에서 409가 반환되며 혼란스러운 에러 메시지가 표시된다.

**확정된 정책:**
- `request.status === 'IN_PROGRESS'`일 때만 capture 버튼 활성화
- `request.status === 'MATCHED'`이면 버튼 비활성 + "가이드가 서비스를 시작하면 결제할 수 있습니다" 안내 문구 표시

## 작업

### 1. `PaymentScreen.tsx` 수정

`mobile/src/screens/PaymentScreen.tsx`

`PaymentScreen`은 이미 `useMyRequests()`로 request 데이터를 가져오고 있다:
```typescript
const request = requestsPage?.items.find((r) => r.id === requestId);
```

아래 로직을 추가하라:

**버튼 비활성 조건 확장:**
```typescript
const isServiceStarted = request?.status === 'IN_PROGRESS';
const isButtonDisabled = isCaptured || isRefunded || capturePayment.isPending || !isServiceStarted;
```

**`getButtonLabel()` 수정:**
- `intent.status === 'AUTHORIZED'`이고 `!isServiceStarted`이면 `'가이드 서비스 시작 대기 중'` 반환
- `intent.status === 'AUTHORIZED'`이고 `isServiceStarted`이면 `'서비스 완료 확인 및 결제'` 반환

**안내 문구 추가:**
capture 버튼 아래에, `!isServiceStarted && !isCaptured && !isRefunded`일 때:
```tsx
<Text style={styles.pendingNote}>가이드가 서비스를 시작하면 결제할 수 있습니다.</Text>
```

`pendingNote` 스타일: `color: '#a3a3a3'`, `fontSize: 13`, `textAlign: 'center'`, `marginTop: 12`

### 2. `PaymentScreen.test.tsx` 케이스 추가

`mobile/src/__tests__/PaymentScreen.test.tsx`에 테스트를 추가하라.

기존 테스트 구조를 파악한 뒤 아래 케이스를 추가하라:

**추가 케이스 1:** `request.status === 'MATCHED'`이면 capture 버튼이 비활성화(disabled)되고 "가이드 서비스 시작 대기 중" 텍스트가 표시되는지 확인

**추가 케이스 2:** `request.status === 'IN_PROGRESS'`이면 capture 버튼이 활성화되고 "서비스 완료 확인 및 결제" 텍스트가 표시되는지 확인

## Acceptance Criteria

```bash
cd /Users/maknkkong/project/localNow/mobile
npm test -- --testPathPattern="PaymentScreen" --passWithNoTests
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - `MATCHED` 상태에서 버튼이 비활성화되고 안내 문구가 표시되는가?
   - `IN_PROGRESS` 상태에서 버튼이 활성화되고 올바른 레이블이 표시되는가?
   - 기존 테스트가 모두 통과하는가?
   - `npm run lint`에서 에러가 없는가?
   - CLAUDE.md: `useState/useReducer`만 사용(Zustand 등 금지), NativeWind 스타일 사용 여부 확인
3. 결과에 따라 `phases/7-payment-capture-guard/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "PaymentScreen MATCHED 상태 capture 버튼 비활성화 + 안내 문구 추가, IN_PROGRESS 상태 활성화 확인, 테스트 2케이스 통과"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `StyleSheet.create` 대신 NativeWind(`className`) 스타일 시스템으로 바꾸지 마라. 이유: `PaymentScreen.tsx`는 이미 `StyleSheet` 기반이며 이번 step에서 전체 스타일 마이그레이션을 하는 것은 범위 밖이다.
- `useMyRequests()` 외에 별도 API 호출을 추가하지 마라. 이유: request 데이터는 이미 훅에서 가져오고 있다.
- 보라 그라데이션, backdrop-blur, glow 등 UI_GUIDE.md 금지 패턴을 사용하지 마라.
- 기존 테스트를 깨뜨리지 마라.
