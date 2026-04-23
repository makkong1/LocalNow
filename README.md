# LocalNow

여행자가 "지금 이 순간" 필요한 현지 가이드/통역/응급 지원을 실시간으로 매칭하는 플랫폼.
이 저장소는 **Spring Boot 백엔드 + Next.js 데모 웹** 의 MVP 를 Claude Code 하네스로 단계별 구축하기 위한 뼈대다.

## 왜 이 프로젝트인가
단일 CRUD 포트폴리오가 아니라, 백엔드의 핵심 주제들을 하나의 도메인에서 동시에 증명하고, 그 결과를 실제 화면에서 시연하는 걸 목표로 한다.

- 실시간 처리 (WebSocket 채팅, 매칭 브로드캐스트)
- 위치 기반 검색 (Redis GEO)
- 비동기 이벤트 (RabbitMQ)
- 동시성 제어 (분산락 + 낙관적 락, 매칭 확정 충돌)
- 결제 상태 머신 (Mock PG 로 실제 흐름만 재현)
- 테스트 전략 (Testcontainers 기반 통합 테스트)
- **데모 웹** (여행자 / 가이드 탭 두 개로 매칭과 채팅을 라이브로 보여줌)

자세한 제품 정의는 [`docs/PRD.md`](docs/PRD.md), 설계 결정은 [`docs/ADR.md`](docs/ADR.md) 를 본다.

## 기술 스택

### Backend (`backend/`)
| 영역 | 선택 |
|------|------|
| 언어/런타임 | Java 21 |
| 프레임워크 | Spring Boot 3.3 (Web, Security, Validation, Data JPA, Data Redis, AMQP, WebSocket) |
| 빌드 | Gradle 8 (Groovy DSL) |
| 데이터 | MySQL 8 + Flyway |
| 캐시/GEO/락 | Redis 7 |
| 메시징 | RabbitMQ 3 |
| 실시간 | STOMP over WebSocket |
| 인증 | JWT (stateless) |
| 테스트 | JUnit 5, AssertJ, Spring Boot Test, Testcontainers |

### Web (`web/`)
| 영역 | 선택 |
|------|------|
| 프레임워크 | Next.js 15 (App Router) + React 19 |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS 4 |
| 서버 상태 | TanStack Query v5 |
| 실시간 | `@stomp/stompjs` + SockJS |
| 지도 | Leaflet + react-leaflet (OpenStreetMap, API 키 불필요) |
| 인증 | HttpOnly 쿠키 + BFF 프록시 (Route Handler) |
| 테스트 | Vitest + React Testing Library, Playwright (핵심 시나리오 1개) |

## MVP 범위
**포함**
- 서버: 회원가입/로그인 · 위치 기반 도움 요청 · 주변 가이드 매칭(제안 → 확정) · 실시간 채팅 · 결제 흐름(Mock PG) · RabbitMQ 이벤트 · 평점/리뷰.
- 웹: 로그인/회원가입 · 여행자 뷰(요청 생성, 후보 목록, 확정, 결제, 채팅) · 가이드 뷰(가용 토글, 요청 수락, 채팅) · 공통 채팅 패널.

**제외**
- 모바일 앱 · 실시간 번역 API · 긴급 AI 챗봇 · 실제 PG 연동 · 추천 시스템 · 광고/보험 제휴 · i18n · Admin 화면 · 모바일 반응형.

근거는 [`docs/PRD.md`](docs/PRD.md), [`docs/ADR.md`](docs/ADR.md) 참고.

## 디렉토리
```
localNow/
├── CLAUDE.md                 # 에이전트에게 강제하는 프로젝트 규칙 (CRITICAL 포함)
├── README.md                 # (이 파일)
├── docker-compose.yml        # (MVP 첫 phase 에서 생성) mysql / redis / rabbitmq
├── backend/                  # (MVP 첫 phase 에서 생성) Spring Boot API 서버
├── web/                      # (MVP 첫 phase 에서 생성) Next.js 데모 웹
├── docs/
│   ├── PRD.md                # 제품 정의, 사용자, MVP 범위
│   ├── ARCHITECTURE.md       # 디렉토리 구조, 계층 / 패턴 / 데이터 흐름
│   ├── ADR.md                # 설계 결정과 트레이드오프
│   ├── API_CONVENTIONS.md    # HTTP/WebSocket 응답 포맷, 에러 코드
│   └── UI_GUIDE.md           # 웹 디자인 토큰 / 금지 패턴
├── .claude/
│   ├── settings.json         # Stop 훅 (non-blocking: compileJava + lint), PreToolUse 위험 명령 가드
│   └── commands/
│       ├── harness.md        # /harness  — 하네스 설계·실행 워크플로우
│       ├── workflow.md       # /workflow — 스킬 파이프라인 순서 (review→fix/refactor→test→commit→docs-sync)
│       ├── review.md         # /review   — 아키텍처·규약·CRITICAL 규칙 점검 체크리스트
│       ├── fix.md            # /fix      — 버그·에러 트러블슈팅
│       ├── refactor.md       # /refactor — 구조·성능·가독성 개선
│       ├── test.md           # /test     — 테스트 생성 (단위·통합·e2e)
│       ├── commit.md         # /commit   — 스테이징·민감파일 제외·커밋·푸시
│       └── docs-sync.md      # /docs-sync — 코드 변경에 따른 문서 동기화
├── scripts/
│   ├── execute.py            # 하네스 실행기 (phase 의 step 들을 순차 실행)
│   ├── stop-check.sh         # Stop 훅 스크립트 (non-blocking, harness 브랜치 스킵)
│   └── test_execute.py
└── phases/                   # (생성 예정) phase 별 step 설계 + 실행 산출물
```

`backend/`, `web/`, `docker-compose.yml` 은 **하네스 실행 시 첫 step 들이 직접 생성**한다. 지금 저장소에 없는 것이 정상이다.

## 하네스 사용 플로우
1. Claude 세션에서 `/harness` 커맨드로 설계 대화를 시작한다.
2. 사용자가 승인하면 다음이 생성된다.
   - `phases/index.json` — phase 전체 인덱스
   - `phases/{task-name}/index.json` — step 목록과 상태
   - `phases/{task-name}/stepN.md` — 각 step 의 지시서
3. 실행기를 돌린다.
   ```bash
   python3 scripts/execute.py 0-mvp            # 순차 실행
   python3 scripts/execute.py 0-mvp --push     # 완료 후 원격 push
   ```
4. 실행기가 자동으로 하는 일
   - `feat-{task-name}` 브랜치 체크아웃/생성
   - `CLAUDE.md` + `docs/*.md` 전체를 매 step 프롬프트의 guardrail 로 주입
   - 완료된 step 의 `summary` 를 다음 step 프롬프트에 컨텍스트로 누적
   - 실패 시 최대 3회 재시도 (이전 에러 메시지를 프롬프트에 피드백)
   - 2단계 커밋 분리 (`feat: ...` / `chore: ... output`)
   - 타임스탬프 자동 기록 (`started_at`, `completed_at`, `failed_at`, `blocked_at`)

에러 복구:
- `error` → `phases/{task}/index.json` 에서 해당 step `status` 를 `"pending"` 으로, `error_message` 삭제 후 재실행.
- `blocked` → `blocked_reason` 을 해결한 뒤 `status` 를 `"pending"` 으로 돌리고 재실행.

## 로컬 개발 (MVP 착수 이후)
MVP 첫 phase 가 끝나면 아래가 동작한다.

```bash
# 1. 로컬 인프라
docker compose up -d

# 2. 백엔드
cd backend && ./gradlew check          # 컴파일 + 테스트
cd backend && ./gradlew bootRun        # http://localhost:8080

# 3. 웹 (새 터미널)
cd web && npm install
cd web && npm run dev                  # http://localhost:3000

# 정리
docker compose down -v
```

환경변수:
- `backend/src/main/resources/application-local.yml` — DB/Redis/RabbitMQ 접속, JWT secret 등. **gitignore.**
- `web/.env.local` — `BACKEND_BASE_URL` 등. **gitignore.**
- 커밋 금지.

## 시연 시나리오 (포트폴리오용)
1. Chrome 탭 A 에서 여행자 계정 로그인 → `/traveler` 에서 도쿄 시부야 좌표로 "2시간 맛집 가이드" 요청 생성.
2. Chrome 탭 B 에서 가이드 계정 로그인 → `/guide` 에서 가용 토글 ON → 새 요청이 실시간으로 나타남 → 수락.
3. 탭 A 에 수락 카드가 뜸 → "이 가이드로 확정" → Mock 결제 → 채팅 패널 활성화.
4. 양쪽 탭에서 채팅 주고받기 → 메시지가 양방향으로 실시간 표시.
5. 동시성 데모: 탭 B 와 탭 C(가이드 2) 가 동시에 수락했다가 탭 A 가 한쪽만 확정 — 나머지는 `MATCH_ALREADY_CONFIRMED` 를 받는 걸 콘솔/UI 에서 확인.

## 품질 기준
- 백엔드: `./gradlew check` 통과.
- 웹: `npm run lint && npm run build` 통과.
- 각 step 은 [`.claude/commands/review.md`](.claude/commands/review.md) 체크리스트로 셀프 리뷰.
- 컨트롤러가 Repository 를 직접 호출하거나, 브라우저가 백엔드를 직접 호출하는 등 `CLAUDE.md` 의 CRITICAL 규칙을 어기면 리뷰 단계에서 반려.

## 라이선스
포트폴리오 목적의 개인 프로젝트. 별도 라이선스 파일 없음.
