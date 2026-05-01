# Step 1: i18n-screens

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 하드코딩된 문자열을 파악하라:

- `/mobile/src/i18n/ko.json` — step 0에서 생성된 번역 키 목록
- `/mobile/src/i18n/index.ts` — step 0에서 생성된 i18n 설정
- 아래 화면 및 컴포넌트 파일 전체:
  - `/mobile/src/screens/LoginScreen.tsx`
  - `/mobile/src/screens/SignupScreen.tsx`
  - `/mobile/src/screens/ForgotPasswordScreen.tsx`
  - `/mobile/src/screens/EmailHintScreen.tsx`
  - `/mobile/src/screens/GuideScreen.tsx`
  - `/mobile/src/screens/TravelerScreen.tsx`
  - `/mobile/src/screens/ChatScreen.tsx`
  - `/mobile/src/screens/ChatListScreen.tsx`
  - `/mobile/src/screens/PaymentScreen.tsx`
  - `/mobile/src/screens/ProfileEditScreen.tsx`
  - `/mobile/src/screens/GuideProfileScreen.tsx`
  - `/mobile/src/screens/ReviewScreen.tsx`
  - `/mobile/src/components/RequestForm.tsx`
  - `/mobile/src/components/RequestCard.tsx`
  - `/mobile/src/components/OnDutyToggle.tsx`
  - `/mobile/src/components/StatusBadge.tsx`

이전 step에서 완료된 변경사항:
- step 0: i18next 설정, ko/en/zh/ja 번역 파일 생성, App 진입점 초기화

## 배경

step 0에서 번역 파일과 i18n 인프라가 준비됐다. 이 step에서는 모든 화면과 컴포넌트에서 하드코딩된 한국어/영어 문자열을 `t('key')` 호출로 교체한다.

## 작업 방식

각 파일에서 아래 패턴을 반복한다:

1. 파일 상단에 `import { useTranslation } from 'react-i18next';` 추가
2. 컴포넌트 함수 내에 `const { t } = useTranslation();` 추가
3. JSX 내 문자열 리터럴(`"텍스트"`) → `{t('key')}` 교체
4. `Alert.alert("제목", "내용")` → `Alert.alert(t('key.title'), t('key.message'))` 교체
5. placeholder, title 등 props 문자열도 교체

**키가 step 0의 ko.json에 없으면 ko.json에 추가하고, en.json / zh.json / ja.json에도 같은 키를 추가하라.**

## 각 파일별 주의사항

### LoginScreen / SignupScreen / ForgotPasswordScreen / EmailHintScreen
- 로그인 실패 `Alert.alert` 메시지 포함
- 입력 필드 `placeholder` prop 포함

### GuideScreen
- step 2(filter-sort)에서 추가된 필터 칩 레이블("전체", "가이드", 등) 포함
- 상태별 안내 텍스트("수락 완료. 여행자가 확정하면 알림이 옵니다." 등) 포함
- step 4(guide-baseloc)에서 추가된 "활동 거점", "거점 설정", "미설정" 포함

### TravelerScreen / RequestForm
- 요청 생성 폼 레이블 (유형, 설명, 시작 시각, 소요 시간, 제안 금액) 포함
- step 3에서 추가된 "장소 검색" placeholder 포함
- 유효성 검사 오류 메시지 포함

### RequestCard
- requestType enum 값을 한국어로 표시하던 부분 → `t('requestType.GUIDE')` 형태로 교체

### StatusBadge
- status enum 값 표시 → `t('status.OPEN')` 형태로 교체

### ChatScreen / ChatListScreen
- 메시지 전송 관련 UI 문자열

### PaymentScreen
- 결제 관련 안내 문자열 (Mock PG 경고 포함)

### ProfileEditScreen
- 프로필 편집 레이블, 인증서 업로드 관련 문자열
- step 4에서 추가된 거점 설정 UI 문자열

### ReviewScreen / GuideProfileScreen
- 별점, 리뷰 관련 문자열

## Acceptance Criteria

```bash
cd mobile && npm run lint     # ESLint 오류 없음
cd mobile && npm test         # 전체 테스트 통과 (하드코딩 문자열이 t() 호출로 바뀌어도 테스트가 통과해야 함)

# 하드코딩 문자열 잔존 여부 확인 (0건이어야 함)
grep -rn '"[가-힣]' mobile/src/screens/ mobile/src/components/ | grep -v "\.json" | grep -v "__mocks__"
# 위 grep에 결과가 없어야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - 모든 화면에서 `useTranslation` 훅이 사용되는가?
   - ko.json에 새로 추가한 키가 en.json / zh.json / ja.json에도 모두 존재하는가?
   - `Alert.alert`의 텍스트 인수도 `t()` 처리됐는가?
   - 테스트 파일에서 i18n 초기화 없이 `t()` 호출 시 키 자체를 반환하므로 기존 테스트가 깨지지 않는가? (i18next는 초기화되지 않으면 키를 그대로 반환한다 — 테스트 환경에서 자연스럽게 동작)
3. 결과에 따라 `phases/10-i18n/index.json`의 step 1을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "12개 화면 + 5개 컴포넌트 전체 한국어/영어 하드코딩 문자열 → t() 키 교체 완료"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- ko.json에 없는 키를 `t('key')`로 사용하지 마라. 반드시 번역 파일에 먼저 추가하라.
- 영어 문자열도 남기지 마라. 영어 텍스트도 en.json의 번역 키로 교체해야 한다.
- 번역 키를 컴포넌트 파일 내에서 직접 정의하지 마라. 모든 키는 i18n/*.json 파일에 있어야 한다.
- 기존 테스트를 깨뜨리지 마라.
