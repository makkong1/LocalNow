# Step 1: backend-admin-api

## 읽어야 할 파일

- `/CLAUDE.md` (컨트롤러·서비스·DTO 규칙)
- `/docs/API_CONVENTIONS.md` (응답 봉투 `ApiResponse`)
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` 의 ADR-014
- 이전 step 산출물: `docs/PRD.md` (Admin 예외 문구)
- 코드: `backend/.../UserRole.java`, `UserService.java`, `SecurityConfig.java`, `SecurityPathPatterns.java`, `JwtAuthenticationFilter.java`, `HelpRequestRepository.java`, `UserRepository.java`, 기존 Flyway `V2__user.sql`

## 작업

### 1. 도메인

- `UserRole` 에 `ADMIN` 추가.
- 공개 회원가입 `UserService.register` 에서 `request.role() == UserRole.ADMIN` 이면 **403** (또는 400 + 문서화된 메시지). 이유: 관리자 계정은 시드·운영 절차로만 생성.

### 2. 스키마

- Flyway 새 마이그레이션: `users.role` ENUM 에 `ADMIN` 추가.
- 동일 마이그레이션 또는 다음 버전에서 **개발용 시드 사용자 1명** 삽입: 고정 이메일(예: `admin@localnow.test`), 이름, `role = ADMIN`, `password` 는 BCrypt 해시(평문은 README/ADR 에만 “로컬 전용”으로 기술). **비밀번호 평문을 코드·커밋에 넣지 마라** — 해시만 마이그레이션에 두거나, ADR 에 “로컬에서 한 번 생성한 해시를 넣는다”고만 적는다.

### 3. 보안

- `SecurityConfig`: `/admin/**` 경로는 `hasRole("ADMIN")` (Spring 규칙: `ROLE_ADMIN` 권한). 기존 `anyRequest().authenticated()` 와 충돌 없게 순서 정리.
- JWT 는 기존처럼 `ROLE_` + role name 이므로 별도 필터 변경은 최소화. `AuthenticationUserRoles` 에 `isAdmin(Authentication)` 정적 메서드를 추가해도 좋다(선택).

### 4. API (읽기 중심)

새 패키지 `com.localnow.admin`(또는 동일한 도메인 경계)에 다음을 둔다:

- **DTO** (`admin/dto/`): 예) `AdminSummaryResponse` — 총 사용자 수, `OPEN` 요청 수, `MATCHED` 수 등 집계 필드. 필드명은 camelCase, API 규약과 맞출 것.
- **AdminService**: Repository 만 사용. 비즈니스 단순 집계·카운트. 컨트롤러가 Repository 를 호출하지 마라.
- **AdminController**: `@RequestMapping("/admin")`, 클래스 또는 메서드에 `@PreAuthorize("hasRole('ADMIN')")` (이미 Security 에서 막더라도 이중 명시 가능).  
  - `GET /admin/summary` → `ApiResponse<AdminSummaryResponse>`  
- 필요 시 `HelpRequestRepository`·`UserRepository` 에 `count...` 파생 쿼리 추가(인터페이스만).

### 5. 테스트

- `AdminService` 단위 테스트(Mockito) 또는 `@WebMvcTest` 로 `GET /admin/summary` 가 **ADMIN** 일 때 200, **TRAVELER/GUIDE** 또는 비인증 시 403/401.
- 기존 회원가입 테스트: `ADMIN` 역할로 가입 시도 시 거부되는 케이스 1개.

## Acceptance Criteria

```bash
cd /Users/maknkkong/project/localNow/backend && ./gradlew check
```

(Docker/Testcontainers 환경이 없어 IT 가 실패하는 경우는 step 완료 보고에 **로컬 Docker 정상 시 재실행**을 적는다. 컴파일·단위 테스트는 반드시 통과시킨다.)

## 검증 절차

1. `./gradlew check` 통과 확인.
2. CLAUDE.md: 컨트롤러 → Repository 직접 호출 없음, 시크릿 하드코딩 없음.
3. `phases/2-admin-ui/index.json` step 1 → `completed`, `summary` 에 생성된 클래스·마이그레이션 버전·시드 이메일(평문 비밀번호 제외) 기록.

## 금지사항

- 관리자 회원가입을 공개 API 로 열지 마라. 이유: 보안.
- 실제 PG·외부 결제 취소 API 를 붙이지 마라. 이유: phase 범위 밖.
- `AsyncStorage` 등 모바일 규칙은 백엔드 step 에서 건드리지 마라.
