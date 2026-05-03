# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (모바일 섹션 집중)
- `/docs/ADR.md` (ADR-011, ADR-012, ADR-013)
- `/docs/API_CONVENTIONS.md`

백엔드는 이미 완성되어 있다. 이 step 에서는 모바일 앱의 뼈대만 만든다.

## 작업

`mobile/` 디렉토리에 React Native (Expo) 프로젝트를 초기화하고, 이후 step 들이 코드를 작성할 수 있는 기반을 만든다.

### 1. 프로젝트 초기화

```bash
cd /Users/maknkkong/project/localNow
npx create-expo-app@latest mobile --template expo-template-blank-typescript
cd mobile
npx expo install expo@~52.0.0 react-native@0.76.0
```

생성 직후 `mobile/package.json` 에서 Expo SDK 52 / React Native 0.76 계열인지 확인한다. `create-expo-app@latest` 가 더 높은 SDK 를 생성한 경우, 이 phase 는 SDK 52 기준으로 맞춘다.

### 2. 의존성 설치

```bash
# 핵심 라이브러리
npx expo install expo-secure-store expo-location react-native-maps

# 네비게이션
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context react-native-gesture-handler

# 서버 상태 / API
npm install @tanstack/react-query

# WebSocket / STOMP
npm install @stomp/stompjs

# idempotent chat message id
npm install react-native-uuid

# 스타일링
npm install nativewind
npm install --save-dev tailwindcss

# 테스트
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native jest-expo
```

### 3. 설정 파일 생성

#### `mobile/app.json`
Expo 앱 설정. `name: "LocalNow"`, `slug: "localnow"`, `scheme: "localnow"`. iOS/Android 공통 설정 포함.

#### `mobile/babel.config.js`
NativeWind 플러그인 포함:
```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ["nativewind/babel"],
  };
};
```

#### `mobile/tailwind.config.js`
```js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#f59e0b',
        surface: '#1a1a1a',
        background: '#0a0a0a',
      }
    }
  },
  plugins: [],
}
```

#### `mobile/tsconfig.json`
`strict: true`. `baseUrl: "."`, `paths: { "@/*": ["src/*"] }` 설정으로 절대 경로 import 활성화.

#### `mobile/.env.local` (gitignore에 추가)
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
```

#### `mobile/.gitignore`
`.env.local`, `node_modules/`, `.expo/` 포함.

### 4. 디렉토리 구조 생성

아래 구조를 만든다. 파일 내용은 빈 export 스텁으로:

```
mobile/src/
├── navigation/
│   ├── RootNavigator.tsx
│   ├── AuthNavigator.tsx
│   └── AppNavigator.tsx
├── screens/
│   ├── LoginScreen.tsx
│   ├── SignupScreen.tsx
│   ├── TravelerScreen.tsx
│   ├── GuideScreen.tsx
│   └── ChatScreen.tsx
├── components/
│   └── .gitkeep
├── lib/
│   ├── api-client.ts
│   ├── stomp-client.ts
│   └── secure-storage.ts
├── hooks/
│   ├── useAuth.ts
│   └── useRealtime.ts
└── types/
    └── api.ts
```

### 5. 진입점 (`mobile/App.tsx`)

`QueryClientProvider` + `NavigationContainer` + `RootNavigator` 를 감싼 최소 진입점. 아직 화면은 빈 `View` 로 두어도 된다.

### 6. Jest 설정

`mobile/jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
};
```

`mobile/package.json` scripts (발췌):

```json
{
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "lint": "eslint src --ext .ts,.tsx",
    "test": "jest --watchAll=false --passWithNoTests"
  }
}
```

Android 네이티브 빌드는 저장소에서 보류 중이다. 필요 시 `npx expo prebuild --platform android` 후 `expo run:android` 로 재도입하고, 현재는 `npm run android` 가 안내 메시지만 출력한다.

## Acceptance Criteria

```bash
cd mobile && npm test           # Jest 실행 (테스트 파일 없어도 0 failures)
cd mobile && npm run lint       # ESLint 에러 0
cd mobile && npx expo export   # 빌드 에러 없음 (정적 번들 추출)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `mobile/` 디렉토리 구조가 ARCHITECTURE.md 와 일치하는가?
   - `.env.local` 이 `.gitignore` 에 포함되어 있는가?
   - `tsconfig.json` 에 `strict: true` 가 설정되어 있는가?
3. 결과에 따라 `phases/1-mobile-app/index.json` step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Expo 프로젝트 초기화, 의존성 설치, 디렉토리 구조 생성 완료. npm test + lint + expo export 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- `EXPO_PUBLIC_API_BASE_URL` 을 코드에 하드코딩하지 마라. 이유: 환경별 URL 이 달라지고, 코드에 서버 주소가 노출된다.
- `EXPO_PUBLIC_*` 에 JWT, API key, secret 을 넣지 마라. 이유: Expo public env 값은 앱 번들에 노출된다.
- `AsyncStorage` 를 설치하거나 임포트하지 마라. 이유: 평문 저장이므로 JWT 저장에 부적합. `expo-secure-store` 만 사용한다.
- 기존 `backend/` 또는 `web/` 코드를 수정하지 마라.
