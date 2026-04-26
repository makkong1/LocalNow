# Step 2: web-admin-dashboard

## 읽어야 할 파일

- `/docs/UI_GUIDE.md`
- `/docs/API_CONVENTIONS.md`
- `/docs/ADR.md` ADR-014
- 이전 step 산출물: `backend` 의 `AdminController` 경로·DTO 필드명
- 코드: `web/src/app/layout.tsx`, `web/src/app/login/page.tsx`, `web/src/lib/api-client.ts`, `web/src/lib/cookies.ts`, 기존 `web/src/app/api/**/route.ts` 패턴 하나
- `web/src/types/api.ts`
- 계약 정합: `mobile/src/types/api.ts` (`UserRole` 유니온)

## 작업

### 1. 타입

- `web/src/types/api.ts`: `UserRole` 에 `'ADMIN'` 추가. `AdminSummaryResponse` 등 step 1 DTO 와 1:1 필드 정의.
- `mobile/src/types/api.ts`: 동일하게 `UserRole` 에 `'ADMIN'` 만 추가(관리자 화면 없음, 계약만 일치). 다른 파일 대규모 수정 금지.

### 2. BFF (Next Route Handlers)

- `web/src/app/api/admin/summary/route.ts` (또는 RESTful 하게 `/api/admin/summary`): 서버에서 `getAuthToken()` 으로 JWT 를 붙여 백엔드 `GET /admin/summary` 호출.  
- 기존 `apiFetch` 또는 `BACKEND_BASE_URL` + `fetch` 패턴을 **다른 api route 와 동일한 스타일**로 맞춘다.
- 비로그인·비관리자: 401/403 시 본문은 `ApiResponse` 실패 형식에 맞게 반환.

### 3. UI

- `web/src/app/admin/page.tsx`: 서버 컴포넌트 우선. `apiFetch` 로 `/auth/me` 를 읽어 `role === 'ADMIN'` 이 아니면 로그인 안내 또는 403 메시지(문구만, 보라색 금지).
- 관리자일 때: 집계 숫자를 카드/테이블로 표시. **다크 배경 + amber/orange 액센트** (`UI_GUIDE.md`). 반응형 풀스택 튜닝은 필수 아님(데스크톱 기준).
- 선택: `web/src/app/admin/layout.tsx` 에서 제목/네비 "Admin" — 기존 `/traveler`·`/guide` 링크와 구분.

### 4. 문서

- `docs/API_CONVENTIONS.md` 에 **관리자 (`/admin`)** 소절을 추가: `GET /admin/summary` | ADMIN | 읽기 전용 집계.

## Acceptance Criteria

```bash
cd /Users/maknkkong/project/localNow/web && npm run lint && npm run build
cd /Users/maknkkong/project/localNow/mobile && npm test && npm run lint
```

(모바일은 타입 1줄 변경 영향·기존 테스트가 있으면 실행. `npm test` 가 프로젝트에 없으면 `npm run lint` 만으로 대체해도 되며, 그 경우 step summary 에 명시.)

## 검증 절차

1. 위 커맨드 통과.
2. `docs/API_CONVENTIONS.md`에 `/admin` 엔드포인트가 실제 백엔드와一致.
3. `phases/2-admin-ui/index.json` step 2 `completed`, summary 에 추가된 경로·파일명.

## 금지사항

- 백엔드 `backend/` 를 이 step 에서 대규모 수정하지 마라. 이유: step 1 경계. 버그만 최소 hotfix.
- `EXPO_PUBLIC_*` 에 시크릿을 넣지 마라(모바일).
- WebSocket·관리자용 실시간 대시보드는 붙이지 마라. 이유: 범위 초과.
