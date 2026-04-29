# Step 1: backend-file-upload

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/API_CONVENTIONS.md`
- `/backend/src/main/java/com/localnow/user/domain/User.java`
- `/backend/src/main/java/com/localnow/user/domain/Certification.java` (Step 0에서 생성)
- `/backend/src/main/java/com/localnow/user/repository/CertificationRepository.java` (Step 0에서 생성)
- `/backend/src/main/java/com/localnow/user/dto/CertificationResponse.java` (Step 0에서 생성)
- `/backend/src/main/java/com/localnow/user/controller/UserController.java`
- `/backend/src/main/java/com/localnow/user/controller/GuideController.java`
- `/backend/src/main/java/com/localnow/user/service/UserService.java`
- `/backend/src/main/java/com/localnow/config/SecurityConfig.java`

이전 step에서 만들어진 코드를 꼼꼼히 읽고 설계 의도를 파악한 뒤 작업하라.

## 작업

파일 업로드 기능 두 가지를 구현한다:
1. **프로필 이미지 업로드** — 여행자/가이드 모두 사용
2. **자격증 PDF 업로드** — 가이드 전용

파일은 백엔드 서버 로컬 파일시스템에 저장하고, Spring의 정적 리소스 서빙으로 URL을 제공한다.

### 1. 파일 저장 경로 설정

`/backend/src/main/resources/application.yml`에 추가:

```yaml
localnow:
  upload:
    dir: ${UPLOAD_DIR:./uploads}
```

`/backend/src/main/java/com/localnow/config/FileStorageConfig.java` 신설:
- `@ConfigurationProperties(prefix = "localnow.upload")`로 `dir` 값을 바인딩
- `@PostConstruct`에서 `uploads/profiles/`, `uploads/certifications/` 디렉토리를 생성 (없으면)

`/backend/src/main/java/com/localnow/config/WebMvcConfig.java` 신설 또는 수정:
- `/files/**` 경로를 `UPLOAD_DIR` 로컬 디렉토리와 매핑하는 정적 리소스 핸들러 추가
- `addResourceHandlers(registry)` 구현

### 2. FileStorageService 신설

`/backend/src/main/java/com/localnow/infra/storage/FileStorageService.java`:

```java
@Service
public class FileStorageService {
    // 이미지 저장: uploads/profiles/{uuid}.{ext} → "/files/profiles/{uuid}.{ext}" 반환
    public String storeProfileImage(MultipartFile file): String

    // PDF 저장: uploads/certifications/{uuid}.pdf → "/files/certifications/{uuid}.pdf" 반환
    public String storeCertification(MultipartFile file): String

    // 파일 삭제 (URL로부터 로컬 경로 역산)
    public void delete(String fileUrl): void
}
```

구현 규칙:
- UUID로 파일명을 재생성해 저장 (원본 파일명 사용 금지 — 경로 탐색 공격 방지)
- 이미지 허용 확장자: jpg, jpeg, png, webp (다른 확장자는 400 Bad Request)
- PDF 허용 확장자: pdf만 허용 (다른 확장자는 400 Bad Request)
- 파일 크기 제한: 이미지 5MB, PDF 10MB (초과 시 400 Bad Request)
- 확장자 검증은 `file.getOriginalFilename()`의 마지막 `.` 이후 문자열로 한다

`/backend/src/main/resources/application.yml`에 multipart 설정 추가:
```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB
```

### 3. 프로필 이미지 업로드 API

`UserController`에 엔드포인트 추가:

```
POST /users/profile-image
Content-Type: multipart/form-data
파라미터: file (MultipartFile)
인증: 필요 (JWT)
```

- `FileStorageService.storeProfileImage(file)` 호출 → URL 반환
- `UserService.updateProfileImage(userId, imageUrl)` 호출 → User 엔티티 업데이트
- 응답: `ApiResponse<UserProfileResponse>` (업데이트된 프로필 반환)
- 기존 이미지가 있으면 `FileStorageService.delete(oldUrl)`로 파일 삭제 후 교체

`UserService`에 `updateProfileImage(Long userId, String imageUrl)` 추가.

### 4. 자격증 업로드/목록/삭제 API

`GuideController`에 엔드포인트 추가:

```
POST /guide/certifications
Content-Type: multipart/form-data
파라미터: file (MultipartFile), name (String, 자격증 이름)
인증: 필요 (JWT), GUIDE 역할 전용
응답: ApiResponse<CertificationResponse>
```

```
GET /guide/certifications
인증: 필요 (JWT), GUIDE 역할 전용
응답: ApiResponse<List<CertificationResponse>>
```

```
DELETE /guide/certifications/{id}
인증: 필요 (JWT), GUIDE 역할 전용
응답: ApiResponse<Void>
```

`CertificationService` 신설 (`/backend/src/main/java/com/localnow/user/service/CertificationService.java`):
```java
public CertificationResponse upload(Long guideId, String name, MultipartFile file)
public List<CertificationResponse> list(Long guideId)
public void delete(Long guideId, Long certId)  // 본인 소유 검증 후 삭제
```

- `delete`는 `CertificationRepository.existsByIdAndUserId()`로 소유 검증 후 파일 삭제 + DB 삭제
- 타인의 자격증 삭제 시도 → 403 Forbidden

### 5. SecurityConfig 수정

`/files/**` 경로는 인증 없이 접근 가능하도록 permitAll() 추가.

## Acceptance Criteria

```bash
cd backend && ./gradlew check
```

추가로 수동 확인:
```bash
cd backend && ./gradlew bootRun
# 별도 터미널에서:
curl -s -X POST http://localhost:8080/users/profile-image \
  -H "Authorization: Bearer <JWT>" \
  -F "file=@/path/to/test.jpg" | jq .
# → profileImageUrl 필드가 "/files/profiles/..." 형태로 반환되어야 함
```

## 검증 절차

1. `./gradlew check` 실행 후 결과 확인
2. 아키텍처 체크:
   - `FileStorageService`가 `infra/storage/` 패키지에 있는가?
   - 컨트롤러가 `FileStorageService`를 직접 주입받지 않고 서비스 계층을 통해 사용하는가?
   - 파일명 UUID 재생성 로직이 있는가?
3. 결과에 따라 `phases/4-guide-profile-offer/index.json` 해당 step 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "FileStorageService(infra/storage), POST /users/profile-image, POST/GET/DELETE /guide/certifications, /files/** 정적 서빙 완료"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러"`

## 금지사항

- 원본 파일명을 그대로 저장하지 마라. 이유: 경로 탐색(path traversal) 취약점 방지.
- 파일 확장자 검증 없이 저장하지 마라. 이유: 악성 파일 업로드 방지.
- `Controller`가 `FileStorageService`를 직접 호출하지 마라. 이유: 비즈니스 로직은 서비스 계층에 있어야 한다.
- 업로드 디렉토리를 `src/main/resources/static/` 안에 두지 마라. 이유: 빌드 시 덮어씌워져 파일이 유실된다.
