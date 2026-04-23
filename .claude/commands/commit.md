# Commit + Push Skill

## 트리거

사용자가 커밋, 푸시, 변경사항 저장을 요청할 때 실행한다.

## 커밋 메시지 컨벤션

이 프로젝트의 커밋 메시지 형식:

```
<type>(<scope>): <한글 설명>
```

### type 자동 분류 규칙

| 변경 내용 | 자동 분류 type |
|-----------|--------------|
| 새 파일 + 새 API 엔드포인트 | `feat` |
| 기존 기능의 버그 수정 | `fix` |
| 기능 변경 없이 구조 개선 | `refactor` |
| `docs/` 하위 또는 `.md` 파일만 변경 | `docs` |
| 설정, 빌드, 의존성 변경 | `chore` |
| 쿼리 최적화, 인덱스 추가, N+1 해결 | `perf` |
| `*Test.java`, `*.test.ts(x)`, `*.spec.ts(x)` 파일 변경 | `test` |

### scope 자동 분류 규칙

LocalNow 는 루트가 `backend/` / `web/` 로 나뉜다. scope 는 **상위 구분자 + 도메인** 조합을 기본으로 한다.

#### 백엔드 (`backend/src/main/java/com/localnow/**`)

| 변경 파일 경로 | 자동 scope |
|--------------|-----------|
| `user/**` | `user` |
| `request/**` | `request` |
| `match/**` | `match` |
| `chat/**` | `chat` |
| `payment/**` | `payment` |
| `notification/**` | `notification` |
| `infra/redis/**` | `redis` |
| `infra/rabbit/**` | `rabbit` |
| `infra/pg/**` | `payment` |
| `infra/translator/**` | `chat` 또는 생략 |
| `config/**` | `config` |
| `common/**` | 관련 도메인 또는 생략 |
| `db/migration/**` | 관련 도메인 (예: `V3__add_match_table.sql` → `match`) |

#### 웹 (`web/**`)

| 변경 파일 경로 | 자동 scope |
|--------------|-----------|
| `src/app/traveler/**` | `web-traveler` |
| `src/app/guide/**` | `web-guide` |
| `src/app/login/**`, `signup/**` | `web-auth` |
| `src/app/api/**` | `web-bff` |
| `src/components/client/Chat*` | `web-chat` |
| `src/components/**`, `src/lib/**`, `src/types/**` | 관련 화면 scope 또는 `web` |

#### 크로스 커팅

| 변경 범위 | scope |
|----------|-------|
| 백엔드 여러 도메인 혼합 | `backend` |
| 웹 여러 화면 혼합 | `web` |
| 백엔드 + 웹 동시 변경 | scope 생략 + 본문에 "backend + web" 명시 |
| `docker-compose.yml`, 루트 설정 | `infra` |
| `.claude/`, `scripts/`, `phases/**` | `harness` |
| `docs/**` | scope 생략 (`docs:` 만) |

### 실제 예시
```
feat(match): Redis 분산락 기반 매칭 확정 동시성 제어
feat(web-guide): 가용 토글과 실시간 요청 목록 추가
fix(chat): STOMP 재연결 시 중복 구독 제거
perf(request): 주변 가이드 조회를 GEOSEARCH 로 단건화
refactor(payment): MockPaymentGateway 상태 머신 분리
test(match): 매칭 확정 동시성 테스트 (Testcontainers)
docs: ADR-009 HttpOnly 쿠키 BFF 추가
chore(harness): Stop 훅이 backend/web 모두 검증하도록 수정
```

## 동작 절차

### 1단계: 변경 분석

```bash
git status
git diff --staged
git diff
```

- staged + unstaged 변경사항을 모두 파악한다.
- 비밀 파일(`application-local.yml`, `.env`, `.env.local`, credentials, `*.key`, `*.pem`)이 포함되면 **경고하고 제외**한다.

### 2단계: 파일 필터링 (안전장치)

변경된 파일 목록을 보여주고 커밋 범위를 확인한다:

```
## 변경 파일 목록

### ✅ 커밋 대상
- M  backend/src/main/java/com/localnow/match/service/MatchService.java
- M  backend/src/main/java/com/localnow/match/controller/MatchController.java
- A  backend/src/main/java/com/localnow/match/dto/MatchConfirmRequest.java

### ⚠️ 제외 (민감 파일)
- M  backend/src/main/resources/application-local.yml

### ❓ 확인 필요
- M  web/package-lock.json  (의존성 락 파일)

→ 이 파일들만 커밋할까? (Y/수정할 파일 번호)
```

**자동 제외 목록**: `application-local.yml`, `application-*.yml`(`application.yml` 제외), `.env`, `.env.*`, `credentials*`, `*.key`, `*.pem`, `*.p12`

### 3단계: 커밋 메시지 추천

- type 과 scope 를 자동 분류한 뒤, 메시지 2~3개를 추천한다.
- **백엔드 + 웹이 섞여 있으면 커밋 분리를 기본 제안**한다(이유: 리뷰어가 계층별로 확인하기 쉬움).
- 여러 백엔드 도메인이 섞여도 분리를 제안한다.

출력 형식:
```
## 추천 커밋 메시지

자동 분류: type=`feat`, scope=`match`

1. `feat(match): 가이드 수락 시 요청 단위 Redis 분산락 적용`
2. `feat(match): 매칭 확정 동시성 제어 추가`

→ 번호 선택 / 직접 수정 / "바로 푸시" (1번으로 커밋+푸시)
```

**백엔드 + 웹 혼합 시:**
```
## ⚠️ 커밋 분리 제안

백엔드와 웹이 동시에 수정되어 분리를 권장한다:

### 커밋 1: backend
- `feat(match): 매칭 확정 API 에 분산락 적용`
- 대상: MatchService.java, MatchController.java, MatchConfirmRequest.java

### 커밋 2: web
- `feat(web-traveler): 가이드 확정 버튼에 낙관적 UI + 에러 코드 분기`
- 대상: web/src/components/client/GuideOfferCard.tsx, web/src/app/api/matches/route.ts

→ 분리해서 커밋할까? (Y/한번에)
```

### 4단계: 커밋 실행

```bash
git add <확인된 파일>
git commit -m "<선택된 메시지>"
```

### 5단계: 푸시

- 커밋 성공 후 "푸시할까?" 확인한다.
- 사용자가 "바로 푸시" 또는 "푸시까지" 라고 했으면 확인 없이 바로 실행한다.

```bash
git push origin <current-branch>
```

### 6단계: 결과 요약

```
## 커밋 완료

- 메시지: `feat(match): 가이드 수락 시 요청 단위 Redis 분산락 적용`
- 파일: 3개 (변경 2, 신규 1)
- 푸시: origin/feat-0-mvp ✅
```

## 빠른 모드

사용자가 "바로 커밋해", "커밋 푸시해" 등 빠른 실행을 요청하면:
1. 변경 분석 → 민감 파일 자동 제외 → type/scope 자동 분류 → 메시지 자동 선택 → 커밋 → 푸시
2. 결과 요약만 보여준다.

## 워크플로우 연계

- `/review` → `/test` 통과 후 → `/commit` 실행이 이상적
- 커밋 후 문서 변경이 필요하면 → `/docs` 제안
- harness 로 실행 중인 step 이 있으면 (feat-* 브랜치 위에 있으면) execute.py 가 step 단위로 자동 커밋한다. 수동 `/commit` 은 harness 밖의 작업(문서 수정, 설정 변경 등)에만 사용한다.

## 제약

- `--force`, `--amend` 는 사용자가 명시적으로 요청할 때만 사용한다.
- `main` 또는 `master` 브랜치에 force push 는 경고 후 사용자 재확인을 받는다.
- 민감 파일은 자동 제외하되, 제외 사실을 반드시 알린다.
- `phases/**/step*-output.json`, `phases/**/phase*-output.json` 은 `.gitignore` 로 이미 제외되어 있다. 혹시 staged 에 들어오면 경고한다.
