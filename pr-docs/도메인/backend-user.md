# Backend Domain: User

## 역할
`user` 도메인은 사용자 인증, 회원 프로필, 가이드 근무 상태를 담당한다. 회원가입과 로그인은 JWT 기반이며, 가이드가 근무 상태를 켜면 Redis GEO 인덱스에 현재 위치를 등록한다.

## 주요 코드
- Controller: `backend/src/main/java/com/localnow/user/controller/UserController.java`
- Controller: `backend/src/main/java/com/localnow/user/controller/GuideController.java`
- Service: `backend/src/main/java/com/localnow/user/service/UserService.java`
- Domain: `backend/src/main/java/com/localnow/user/domain/User.java`
- Domain: `backend/src/main/java/com/localnow/user/domain/UserRole.java`
- Repository: `backend/src/main/java/com/localnow/user/repository/UserRepository.java`
- DTO: `SignupRequest`, `LoginRequest`, `AuthResponse`, `UserProfileResponse`

## API
| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `POST` | `/auth/signup` | Public | 이메일, 비밀번호, 이름, 역할, 도시로 회원가입한다. |
| `POST` | `/auth/login` | Public | 로그인 후 JWT와 기본 사용자 정보를 반환한다. |
| `GET` | `/auth/me` | Authenticated | 현재 로그인한 사용자 프로필을 조회한다. |
| `POST` | `/guide/duty` | GUIDE | 가이드 근무 상태를 켜거나 끈다. `onDuty=true`일 때 `lat`, `lng`가 필요하다. |

## 도메인 규칙
- 역할은 `TRAVELER`, `GUIDE`로 구분한다.
- 비밀번호는 BCrypt로 저장한다.
- 로그인 응답의 JWT payload에는 `sub`, `role`, `exp`만 포함한다.
- 가이드 온듀티 상태는 Redis GEO 키를 통해 매칭 후보 탐색에 사용된다.
- 가이드 평점(`avgRating`, `ratingCount`)은 리뷰 작성 시 `review` 도메인에서 갱신한다.

## 외부 의존성
- `config/JwtProvider`: JWT 생성과 검증.
- `config/SecurityConfig`: `/auth/**` 공개, 그 외 인증 요구.
- `infra/redis/RedisGeoService`: 가이드 위치 등록과 삭제.

## 테스트 포인트
- 회원가입 시 이메일 중복을 거절한다.
- 로그인 시 비밀번호 검증 실패를 인증 오류로 변환한다.
- `GET /auth/me`는 인증 사용자 기준으로 프로필을 반환한다.
- `POST /guide/duty`는 GUIDE 권한과 위치 필수 조건을 검증한다.
