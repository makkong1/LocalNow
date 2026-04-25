# Documentation Sync Skill

## 트리거

사용자가 문서화, 문서 동기화, 문서 업데이트를 요청할 때 실행한다.

## 이 프로젝트의 문서 구조

**LocalNow 의 `docs/` 는 flat 한 5개 파일 구조다.** 도메인별 서브 디렉토리를 만들지 않는다.

```
docs/
├── PRD.md                # 제품 정의, 사용자, MVP 범위
├── ARCHITECTURE.md       # 디렉토리 구조, 계층 / 패턴 / 데이터 흐름
├── ADR.md                # 설계 결정과 트레이드오프 (ADR-001, ADR-002, ...)
├── API_CONVENTIONS.md    # HTTP/WebSocket 응답 포맷, 에러 코드, 네이밍
└── UI_GUIDE.md           # 웹(`web/`) 디자인 토큰 + 금지 패턴
```

추가로 프로젝트 규칙은 `/CLAUDE.md`, 저장소 개요는 `/README.md` 에 둔다.

**새 서브 디렉토리를 만들지 마라.** 트러블슈팅 기록·리팩토링 기록 같은 것은 MVP 에서 쓰지 않는다. 필요해지면 ADR 로 먼저 제안한다.

## 동작 절차

### 1단계: 변경 영향 분석 (자동 트리거)

변경된 코드 파일을 기반으로 **어떤 문서를 수정해야 하는지 자동으로 판단**한다.

#### 영향 매핑 테이블

| 변경된 파일 유형 | 영향 받는 문서 | 필수 업데이트 내용 |
|----------------|-------------|------------------|
| 백엔드 `*Controller.java` | `docs/API_CONVENTIONS.md` (신규 엔드포인트일 때) | URL 패턴·응답 포맷이 규약을 벗어나지 않았는지 확인 |
| 백엔드 `*DTO.java` 응답 구조 변경 | `docs/API_CONVENTIONS.md`, `web/src/types/api.ts` | 응답 봉투·필드명·에러 코드 반영 |
| 백엔드 새 도메인 패키지 / 새 계층 | `docs/ARCHITECTURE.md` → "디렉토리 구조" | 트리에 실제 경로 반영 |
| 동시성·트랜잭션·이벤트 전략 변경 | `docs/ARCHITECTURE.md` → "패턴" / "데이터 흐름" | 변경된 플로우 갱신 |
| 기술 스택 추가·교체 (의존성 추가) | `docs/ADR.md` → 새 ADR 추가 | 결정·이유·트레이드오프 3줄 |
| 외부 서비스(실 PG, 번역, 지도) 연동 | `docs/ADR.md` + `/CLAUDE.md` | "MVP 제외" 규칙을 깼는지 확인 |
| 새 에러 코드 추가 | `docs/API_CONVENTIONS.md` → "에러 코드" 표 | HTTP 상태·설명 추가 |
| WebSocket 채널·페이로드 변경 | `docs/API_CONVENTIONS.md` → "WebSocket (STOMP) 채널 규약" | 라우팅·페이로드·멱등키 |
| 웹 색/타이포/버튼 스타일 변경 | `docs/UI_GUIDE.md` | 토큰 값·금지 패턴 반영 |
| 새 페이지/주요 화면 추가 | `docs/PRD.md` → "웹 화면" 섹션 | 사용자 플로우 한 줄 |
| MVP 스코프 변경 (포함/제외 조정) | `docs/PRD.md` → "MVP 제외 사항" + 관련 ADR | 이유까지 명시 |
| `CLAUDE.md` CRITICAL 규칙 추가/수정 | `CLAUDE.md` | 이유는 ADR 로 이관 |

**어디에도 해당 안 되는 변경이면 문서 업데이트 불필요로 보고한다.**

### 2단계: 문서 수정 범위 출력

```
## 문서 업데이트 필요

코드 변경 기반으로 아래 문서가 영향받는다:

### 📋 필수 업데이트
1. `docs/API_CONVENTIONS.md` → "에러 코드" 표
   - 신규: MATCH_ALREADY_CONFIRMED (409) 추가

2. `web/src/types/api.ts`
   - ErrorCode 유니언에 `MATCH_ALREADY_CONFIRMED` 추가

### 📝 권장 업데이트
3. `docs/ARCHITECTURE.md` → "데이터 흐름"
   - 매칭 확정 분산락 흐름이 현재 텍스트와 어긋남. 1~2줄 갱신.

→ 어디까지 업데이트할까? (전부 / 번호 선택)
```

### 3단계: 코드 기반 사실 확인

문서를 작성/수정하기 전에 반드시 실제 코드를 읽어서 사실을 확인한다:

- Entity 필드·관계·제약조건
- Controller 엔드포인트·요청/응답 형식
- Service 비즈니스 로직 흐름 (특히 상태 머신, 락 전략)
- 새 ErrorCode enum 값
- 웹 Route Handler (`web/src/app/api/**`) 의 응답 포맷

**코드와 문서가 다르면 코드가 진실이다.** 문서 수정 시에도 코드 스니펫을 그대로 옮기지 말고, 독자가 이해할 수 있는 수준으로 요약한다.

### 4단계: 문서 작성/수정

LocalNow 는 flat 구조라 새 파일을 만들기보다 **기존 파일 안의 해당 섹션에 덧붙이는 것이 기본**이다.

- **ADR 추가**: `docs/ADR.md` 끝에 `### ADR-0XX: {결정}` 블록을 추가. 기존 ADR 번호를 이어 간다.
- **에러 코드 추가**: `docs/API_CONVENTIONS.md` 의 에러 코드 표 한 줄 추가.
- **엔드포인트 규약 변경**: 문서의 해당 규칙 섹션을 수정하고, 본문에 "변경 이유" 를 1~2줄 남긴다.
- **UI 토큰 변경**: `docs/UI_GUIDE.md` 해당 표의 값만 교체. 금지 패턴을 추가했다면 이유도 한 줄.

### 5단계: 관련 문서 간 정합성 체크

변경 후 아래 1:1 대응이 깨지지 않았는지 확인한다:

- `docs/API_CONVENTIONS.md` ↔ `web/src/types/api.ts` (ErrorCode, 응답 봉투, 페이로드)
- `docs/ARCHITECTURE.md` 디렉토리 트리 ↔ 실제 `backend/`, `web/` 디렉토리
- `docs/ADR.md` 에 제외된다고 명시한 기술 ↔ 실제 의존성(`build.gradle`, `package.json`)
- `docs/PRD.md` MVP 제외 목록 ↔ 실제 구현 코드

### 6단계: 변경 요약

```
## 문서 업데이트 완료

| 문서 | 변경 내용 |
|------|----------|
| `docs/API_CONVENTIONS.md` | 에러 코드 1건 추가 (MATCH_ALREADY_CONFIRMED) |
| `web/src/types/api.ts` | ErrorCode 유니언 동기화 |
| `docs/ADR.md` | (변경 없음, 기존 ADR-004 범위 내) |
```

## 워크플로우 연계

- `/refactor` 완료 후 → 구조가 ARCHITECTURE.md 와 어긋났으면 `/docs` 제안
- `/fix` 완료 후 → 새 에러 코드나 규약 변경이 있으면 `/docs` 제안
- `/commit` 시 문서 변경이 필요하면 커밋 전 `/docs` 제안 (같은 커밋에 포함)
- harness step 안에서는 step 자체가 문서 정합성까지 책임지도록 지시서에 명시해두는 게 먼저다. `/docs` 는 harness 밖의 수정에서 주로 쓴다.

## 제약

- 추측으로 문서를 작성하지 않는다. 코드에서 확인한 사실만 기록한다.
- 기존 문서의 형식·톤·섹션 구성을 유지한다. 새 구조를 도입하지 마라.
- `docs/` 아래에 새 서브디렉토리를 만들지 마라. flat 구조를 유지한다.
- `docs/UI_GUIDE.md` 는 웹 변경이 있을 때만 건드린다. 백엔드 전용 변경과 섞지 마라.
