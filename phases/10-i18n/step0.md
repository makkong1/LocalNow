# Step 0: i18n-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 현재 구조를 파악하라:

- `/mobile/package.json` — 현재 설치된 패키지 목록
- `/mobile/src/screens/LoginScreen.tsx` — 하드코딩된 문자열 패턴 파악
- `/mobile/src/screens/GuideScreen.tsx` — 가이드 화면 문자열 패턴 파악
- `/mobile/app.json` — 앱 설정 (locale 관련)

## 배경

LocalNow는 한국에서 외국인 여행자를 위한 서비스이므로 다국어 지원이 필요하다. 지원 언어: **한국어(ko)**, **영어(en)**, **중국어 간체(zh)**, **일본어(ja)**. 이 step에서는 i18n 인프라를 구축하고 번역 파일을 생성한다. 실제 화면 텍스트 마이그레이션은 step 1에서 진행한다.

## 작업

### 1. 패키지 설치

```bash
npx expo install expo-localization
npm install i18next react-i18next
```

`expo-localization`: 기기 언어 감지 (`expo-localization`은 Expo SDK 52에 내장됐을 수 있음 — 이미 있으면 설치 생략)

### 2. i18n 설정 파일 생성

파일: `mobile/src/i18n/index.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import ko from './ko.json';
import en from './en.json';
import zh from './zh.json';
import ja from './ja.json';

const LANG_KEY = 'app_language';

export const SUPPORTED_LANGUAGES = ['ko', 'en', 'zh', 'ja'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export async function initI18n(): Promise<void> {
  const saved = await SecureStore.getItemAsync(LANG_KEY);
  const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'ko';
  const detected = SUPPORTED_LANGUAGES.find(l => deviceLocale.startsWith(l)) ?? 'ko';
  const lng: SupportedLanguage = (saved as SupportedLanguage) ?? detected;

  await i18n.use(initReactI18next).init({
    resources: { ko: { translation: ko }, en: { translation: en }, zh: { translation: zh }, ja: { translation: ja } },
    lng,
    fallbackLng: 'ko',
    interpolation: { escapeValue: false },
  });
}

export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await SecureStore.setItemAsync(LANG_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
```

### 3. App 진입점에서 i18n 초기화

파일: `mobile/App.tsx` (또는 루트 진입점, 프로젝트 구조에 따라)

i18n을 비동기 초기화하므로, 초기화 완료 전에 스플래시 화면이나 로딩 인디케이터를 보여주도록 처리하라:

```typescript
import { initI18n } from './src/i18n';

// 앱 컴포넌트 내 useEffect 또는 최초 마운트 시
const [i18nReady, setI18nReady] = useState(false);

useEffect(() => {
  initI18n().then(() => setI18nReady(true));
}, []);

if (!i18nReady) return <LoadingScreen />;
```

### 4. 번역 파일 생성

아래 파일들을 생성하라. 키 구조는 화면/컴포넌트별로 네임스페이스를 두지 않고 flat key 구조를 사용한다 (단일 translation 네임스페이스).

파일: `mobile/src/i18n/ko.json`

현재 화면들에서 사용되는 모든 한국어 문자열의 키-값을 포함하라. 아래는 초기 키 목록 예시 (실제 코드를 읽고 모든 문자열을 추출해야 함):

```json
{
  "common": {
    "loading": "로딩 중...",
    "error": "오류가 발생했습니다",
    "cancel": "취소",
    "save": "저장",
    "confirm": "확인",
    "close": "닫기",
    "retry": "다시 시도"
  },
  "auth": {
    "login": "로그인",
    "logout": "로그아웃",
    "signup": "회원가입",
    "email": "이메일",
    "password": "비밀번호",
    "forgotPassword": "비밀번호 찾기",
    "google": "Google로 로그인"
  },
  "guide": {
    "nearbyRequests": "주변 도움 요청",
    "noRequests": "주변에 요청이 없습니다",
    "onDuty": "근무 시작",
    "offDuty": "근무 종료",
    "accept": "수락",
    "startService": "서비스 시작",
    "goToChat": "채팅하기",
    "filterAll": "전체",
    "sortDefault": "기본",
    "sortPriceAsc": "가격↑",
    "sortPriceDesc": "가격↓",
    "baseLocation": "활동 거점",
    "setBaseLocation": "거점 설정",
    "baseLocationNotSet": "미설정"
  },
  "traveler": {
    "createRequest": "도움 요청",
    "myRequests": "내 요청",
    "requestType": "요청 유형",
    "description": "설명",
    "startAt": "시작 시각",
    "duration": "소요 시간",
    "budget": "제안 금액",
    "locationSearch": "장소 검색",
    "searchPlaceholder": "장소명을 입력하세요"
  },
  "requestType": {
    "GUIDE": "가이드",
    "TRANSLATION": "통역",
    "FOOD": "음식",
    "EMERGENCY": "긴급"
  },
  "status": {
    "OPEN": "요청 중",
    "MATCHED": "매칭됨",
    "IN_PROGRESS": "진행 중",
    "COMPLETED": "완료",
    "CANCELLED": "취소됨"
  }
}
```

파일: `mobile/src/i18n/en.json`

위 ko.json의 모든 키에 대한 영어 번역을 제공하라.

파일: `mobile/src/i18n/zh.json`

위 ko.json의 모든 키에 대한 중국어 간체 번역을 제공하라.

파일: `mobile/src/i18n/ja.json`

위 ko.json의 모든 키에 대한 일본어 번역을 제공하라.

**주의**: 번역 키 목록은 예시다. 실제 화면 파일들(`mobile/src/screens/`, `mobile/src/components/`)을 모두 읽고 하드코딩된 텍스트를 전수 추출해 키로 등록하라. step 1에서 `t('key')`로 교체할 모든 문자열이 여기 포함돼야 한다.

## Acceptance Criteria

```bash
cd mobile && npm run lint     # TypeScript 타입 오류 없음
cd mobile && npm test         # 전체 테스트 통과

# i18n 초기화 검증
grep -r "initI18n\|i18next\|useTranslation" mobile/src/i18n/
# 파일 존재 확인
ls mobile/src/i18n/
# → index.ts ko.json en.json zh.json ja.json
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - ko.json, en.json, zh.json, ja.json 모두 동일한 키 구조를 가지는가?
   - `initI18n()`이 App 진입점에서 비동기로 호출되는가?
   - 언어 저장에 `expo-secure-store`를 사용하는가 (AsyncStorage 금지)?
   - 기기 언어 감지 → 지원 언어 매핑 → 저장된 언어 우선 적용 순서가 맞는가?
3. 결과에 따라 `phases/10-i18n/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "i18next + react-i18next 설치, ko/en/zh/ja 번역 파일 생성, initI18n 비동기 초기화 구현, SecureStore 언어 저장"`
   - 실패(3회) → `"status": "error"`, `"error_message": "<에러 내용>"`

## 금지사항

- `AsyncStorage`에 언어 설정을 저장하지 마라. CLAUDE.md CRITICAL 규칙. `expo-secure-store`를 사용하라.
- 번역 파일에 빈 문자열 값(`""`)을 넣지 마라. 누락 키는 ko.json 값으로 폴백한다.
- 네임스페이스를 여러 개 만들지 마라. 단일 `translation` 네임스페이스에 flat key 구조를 사용한다.
- 기존 테스트를 깨뜨리지 마라.
