# Step 2: i18n-selector

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 구현을 파악하라:

- `/mobile/src/i18n/index.ts` — changeLanguage, SUPPORTED_LANGUAGES 함수
- `/mobile/src/screens/ProfileEditScreen.tsx` — step 1에서 수정된 프로필 편집 화면
- `/mobile/src/navigation/AppNavigator.tsx` — 네비게이션 구조 파악
- `/docs/UI_GUIDE.md` — 다크 테마, amber/orange 포인트 컬러 규칙

이전 step들에서 완료된 변경사항:
- step 0: i18next 설정, ko/en/zh/ja 번역 파일, SecureStore 언어 저장
- step 1: 모든 화면/컴포넌트 문자열 → t() 교체

## 배경

앱이 자동으로 기기 언어를 감지해 설정되지만, 사용자가 직접 언어를 바꿀 수 있어야 한다. 이 step에서는 언어 선택 UI를 ProfileEditScreen에 추가한다. 앱 언어 변경은 즉시 반영된다.

## 작업

### 1. ProfileEditScreen — 언어 선택 섹션 추가

파일: `mobile/src/screens/ProfileEditScreen.tsx`

화면 최상단(로그인 여부와 무관하게 항상 보이는 위치)에 언어 선택 섹션을 추가하라. 로그인 전에도 접근 가능해야 하므로, 인증 필요 없이 렌더되는 위치에 배치하라.

**현재 언어 표시 + 언어 버튼**:

```typescript
import { useTranslation } from 'react-i18next';
import { changeLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

const { i18n, t } = useTranslation();

const LANG_LABELS: Record<SupportedLanguage, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  ja: '日本語',
};
```

UI 구조:
- 섹션 레이블: `t('settings.language')` (번역 키 추가 필요)
- 가로 배치된 4개 버튼: 한국어 / English / 中文 / 日本語
- 현재 선택 언어: amber 배경(`#f59e0b`) + 검정 텍스트 + bold
- 미선택: `#1c1c1c` 배경 + `#a3a3a3` 텍스트, 테두리 `#262626`
- 버튼 탭 시 `changeLanguage(lang)` 호출

언어 변경 시 react-i18next가 리렌더를 트리거하므로 별도 상태 없이 `i18n.language`를 현재 선택 언어로 사용하면 된다.

### 2. 번역 키 추가

파일: `mobile/src/i18n/ko.json`, `en.json`, `zh.json`, `ja.json`

언어 선택 섹션에 필요한 키를 추가하라:

```json
"settings": {
  "language": "언어 설정",
  "languageChanged": "언어가 변경됐습니다"
}
```

### 3. LoginScreen에도 언어 선택 버튼 추가 (선택사항)

외국인 사용자가 로그인 전에도 언어를 바꿀 수 있도록 LoginScreen 상단이나 하단에 콤팩트한 언어 버튼을 추가하면 좋다. 필수는 아니지만 권장한다.

콤팩트 버튼 (텍스트만, 가로 나열):
```
한국어 · English · 中文 · 日本語
```
현재 선택 언어는 amber 색상으로 강조.

## Acceptance Criteria

```bash
cd mobile && npm run lint     # ESLint 오류 없음
cd mobile && npm test         # 전체 테스트 통과

# 번역 키 존재 확인
grep -c "settings" mobile/src/i18n/ko.json
grep -c "settings" mobile/src/i18n/en.json
grep -c "settings" mobile/src/i18n/zh.json
grep -c "settings" mobile/src/i18n/ja.json
# 각 결과가 1 이상이어야 함
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - ProfileEditScreen에서 4개 언어 버튼이 가로로 표시되는가?
   - 현재 선택 언어 버튼이 amber 강조되는가?
   - 버튼 탭 시 화면 내 모든 텍스트가 즉시 해당 언어로 전환되는가?
   - SecureStore에 저장된 언어가 앱 재시작 후에도 유지되는가?
   - `settings.language` 키가 4개 번역 파일 모두에 있는가?
3. 결과에 따라 `phases/10-i18n/index.json`의 step 2를 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "ProfileEditScreen 언어 선택 UI(ko/en/zh/ja) 추가. 즉시 전환, SecureStore 영구 저장. LoginScreen 콤팩트 언어 버튼 추가"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- `AsyncStorage`에 언어 설정을 저장하지 마라. `changeLanguage` 함수가 이미 `expo-secure-store`를 사용한다.
- SUPPORTED_LANGUAGES에 없는 언어 코드를 추가하지 마라. 번역 파일 없이 추가하면 폴백(ko)으로 깨진다.
- 기존 테스트를 깨뜨리지 마라.
