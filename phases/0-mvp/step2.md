# Step 2: backend-user

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/API_CONVENTIONS.md`
- `/backend/src/main/java/com/localnow/common/ApiResponse.java`
- `/backend/src/main/java/com/localnow/common/ErrorCode.java`
- `/backend/src/main/java/com/localnow/config/JwtProvider.java`
- `/backend/src/main/java/com/localnow/config/SecurityConfig.java`

이전 step에서 만들어진 공통 타입과 JWT/Security 설정을 먼저 읽고 의존 방식을 파악한 뒤 작업하라.

## 작업

`user/` 도메인: 회원가입, 로그인, JWT 발급을 담당한다. 다른 도메인이 참조하는 `User` 엔티티와 `userId`를 확립한다.

### 1. DB 마이그레이션 `V2__user.sql`

경로: `backend/src/main/resources/db/migration/V2__user.sql`

```sql
CREATE TABLE users (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    email        VARCHAR(255) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,  -- BCrypt 해시
    name         VARCHAR(100) NOT NULL,
    role         ENUM('TRAVELER','GUIDE') NOT NULL,
    languages    VARCHAR(500),           -- 쉼표 구분 언어 코드 (예: "ko,en")
    city         VARCHAR(100),           -- 거주 도시
    avg_rating   DECIMAL(3,2) DEFAULT 0.00,
    rating_count INT          DEFAULT 0,
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. `user/domain/User.java` (JPA 엔티티)

- 위 테이블과 1:1 매핑.
- `role` 필드: `UserRole` enum (`TRAVELER`, `GUIDE`).
- 비밀번호 필드는 `@JsonIgnore`로 직렬화에서 제외.
- `@Version` 추가 금지 — 낙관적 락은 `match/` 도메인에서만 사용.

### 3. `user/repository/UserRepository.java`

`JpaRepository<User, Long>` 상속.
- `Optional<User> findByEmail(String email)`

### 4. `user/dto/` (Request/Response DTO)

- `SignupRequest`: `email`, `password`, `name`, `role`(TRAVELER|GUIDE), `languages`(List<String>), `city`. Bean Validation 어노테이션 포함(`@NotBlank`, `@Email`, `@Size`).
- `LoginRequest`: `email`, `password`.
- `AuthResponse`: `accessToken`, `userId`, `role`, `name`.
- `UserProfileResponse`: `id`, `email`, `name`, `role`, `languages`, `city`, `avgRating`, `ratingCount`.

### 5. `user/service/UserService.java`

메서드 시그니처:
```java
AuthResponse register(SignupRequest request);   // 이메일 중복 시 IllegalArgumentException
AuthResponse login(LoginRequest request);       // 비밀번호 불일치 시 IllegalArgumentException
UserProfileResponse getProfile(Long userId);
```

규칙:
- 비밀번호는 `BCryptPasswordEncoder`로 해시한 뒤 저장.
- 로그인 성공 시 `JwtProvider.generateToken(userId, role)` 호출 → `AuthResponse` 반환.
- 비즈니스 예외는 `ResponseStatusException(HttpStatus.UNAUTHORIZED, "...")` 또는 `ResponseStatusException(HttpStatus.CONFLICT, "...")` 사용 — `GlobalExceptionHandler`가 처리.

### 6. `user/controller/UserController.java`

Base URL: `/auth`

| HTTP | Path | 설명 | 인증 |
|------|------|------|------|
| POST | `/auth/signup` | 회원가입 | 불필요 |
| POST | `/auth/login`  | 로그인 → JWT 반환 | 불필요 |
| GET  | `/auth/me`     | 내 프로필 | 필요 |

모든 응답은 `ApiResponse<T>` 봉투로 감싼다.
컨트롤러는 `UserService`만 호출한다. `UserRepository` 직접 호출 금지.

### 7. 테스트

#### `user/service/UserServiceTest.java` (단위 테스트, Mockito)

- 정상: 회원가입 → 로그인 → 토큰 반환
- 예외: 이메일 중복 회원가입
- 예외: 비밀번호 불일치 로그인
- 경계: `role=GUIDE`로 가입 후 `avgRating` 초기값 0.00

#### `user/controller/UserControllerTest.java` (`@WebMvcTest`)

- POST `/auth/signup` 정상 케이스 → 201, `ApiResponse.success=true`
- POST `/auth/login` 정상 케이스 → 200, `accessToken` 존재
- POST `/auth/signup` 검증 실패 (`email` 누락) → 422, `VALIDATION_FAILED`

## Acceptance Criteria

```bash
cd backend && ./gradlew check
```

## 검증 절차

1. `./gradlew check` 실행.
2. 체크리스트:
   - `UserController`가 `UserRepository`를 직접 주입받지 않는가?
   - 응답이 `ApiResponse<AuthResponse>` 형식인가?
   - BCrypt 해시 후 저장하는가? (평문 저장 금지)
   - JWT payload에 `sub`, `role`, `exp` 외 PII가 없는가?
3. `phases/0-mvp/index.json` step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "user 도메인(User 엔티티/UserService/UserController) + V2__user.sql 완료. /auth/signup, /auth/login, /auth/me 동작. ./gradlew check 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- 비밀번호를 평문 또는 MD5/SHA1로 저장하지 마라. 이유: 보안 위반.
- `UserController`에서 `UserRepository`를 직접 호출하지 마라. 이유: CLAUDE.md CRITICAL 규칙.
- `User` 엔티티를 컨트롤러 응답으로 직접 반환하지 마라. 이유: DTO와 엔티티 분리 원칙.
- 기존 테스트를 깨뜨리지 마라.
