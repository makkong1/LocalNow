# Step 0: admin-adr

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 기획·설계와 충돌이 없는지 파악하라:

- `/docs/PRD.md` (특히 MVP 제외의 "Admin 화면" 문단)
- `/docs/ADR.md` (마지막 ADR 번호 확인)
- `/docs/UI_GUIDE.md` (다크·amber 포인트 일관성)
- `/docs/ARCHITECTURE.md` — "웹 (0-mvp 참조 구현)" 섹션

## 작업

PRD는 **전사용 Admin 제품**을 제외했으나, 이번 phase 는 **로컬/데모용 최소 관리자 뷰**를 `web/` 에 추가하는 것이다. 근거를 ADR 로 남기고 PRD 한 줄을 갱신한다.

### 1. `docs/ADR.md` 에 **ADR-014** 추가

다음을 만족하는 결정 기록을 작성한다 (3~5문장):

- **결정**: 운영자용 풀 기능이 아니라, `UserRole.ADMIN` + JWT + `web` 의 읽기 중심 대시보드(집계 수치 등)로 **DB 직접 접근을 대체할 최소 시연 경로**를 만든다.
- **이유**: 포트폴리오·로컬 검증에서 요청/사용자 규모를 화면으로 보는 니즈; PRD 의 "DB 직접 수정"은 개발자 경험에 불리하다.
- **트레이드오프**: 실제 권한 모델·감사 로그·2FA 는 범위 밖. 공개 회원가입으로 `ADMIN` 역할을 부여하지 않는다(후속 step 에서 서버가 거부).
- **범위**: 백엔드는 읽기 API 위주; 쓰기·신고/환불 워크플로는 포함하지 않는다(필요 시 별도 phase).

### 2. `docs/PRD.md` 수정 (최소)

- **MVP 제외 사항** 의 "Admin 화면" 한 줄을 바꾸거나, 바로 아래에 **예외** 한 줄을 추가한다: 데모 웹에 **제한적 읽기 전용** 관리 화면을 둘 수 있으며, 상세는 ADR-014 를 따른다는 취지.

기존 문장 톤·불릿 형식을 유지한다.

## Acceptance Criteria

```bash
grep -q 'ADR-014' /Users/maknkkong/project/localNow/docs/ADR.md \
  && grep -q 'ADR-014\|관리\|Admin' /Users/maknkkong/project/localNow/docs/PRD.md
```

(둘 다 exit code 0 이면 성공. PRD 는 한글 제목으로 grep 이 애매하면 `docs/PRD.md` 수동 확인.)

## 검증 절차

1. 위 AC 를 실행한다.
2. `docs/API_CONVENTIONS.md` 는 이 step 에서 수정하지 않는다(step 2 에서 반영).
3. `phases/2-admin-ui/index.json` 의 step 0 을 `"status": "completed"`, `"summary": "ADR-014 및 PRD 예외/갱신 한 줄"` 로 업데이트한다.

## 금지사항

- 백엔드·웹 코드를 이 step 에서 수정하지 마라. 이유: 문서만으로 범위 합의를 고정한다.
- `docs/` 아래 새 서브디렉토리를 만들지 마라. 이유: 프로젝트 규칙(flat `docs/`).
- 보라/인디고 등 `UI_GUIDE.md` 가 금지한 시각적 방향을 ADR 에 쓰지 마라.
