# Step 0: backend-user-schema

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/API_CONVENTIONS.md`
- `/backend/src/main/java/com/localnow/user/domain/User.java`
- `/backend/src/main/java/com/localnow/user/dto/UserProfileResponse.java`
- `/backend/src/main/java/com/localnow/user/dto/SignupRequest.java`
- `/backend/src/main/java/com/localnow/user/service/UserService.java`
- `/backend/src/main/resources/db/migration/V2__user.sql`
- `/backend/src/main/resources/db/migration/V10__cursor_indexes.sql` (최신 마이그레이션 번호 확인용)

## 작업

### 1. Flyway 마이그레이션 파일 생성

`/backend/src/main/resources/db/migration/V11__guide_profile.sql` 파일을 생성한다.

포함할 내용:
```sql
-- users 테이블에 컬럼 추가
ALTER TABLE users
    ADD COLUMN profile_image_url VARCHAR(500) NULL,
    ADD COLUMN birth_year SMALLINT NULL,
    ADD COLUMN bio TEXT NULL;

-- 자격증 테이블 생성 (가이드 전용)
CREATE TABLE certifications (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    user_id     BIGINT NOT NULL,
    name        VARCHAR(200) NOT NULL,
    file_url    VARCHAR(500) NOT NULL,
    uploaded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_cert_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_cert_user ON certifications(user_id);
```

### 2. User 엔티티 수정

`/backend/src/main/java/com/localnow/user/domain/User.java`에 필드 추가:

```java
@Column(name = "profile_image_url")
private String profileImageUrl;

@Column(name = "birth_year")
private Short birthYear;

@Column(name = "bio", columnDefinition = "TEXT")
private String bio;
```

Setter/업데이트 메서드도 추가한다:
```java
public void updateProfile(String profileImageUrl, Short birthYear, String bio) { ... }
```

### 3. Certification 엔티티 생성

`/backend/src/main/java/com/localnow/user/domain/Certification.java` 신설:

```java
@Entity
@Table(name = "certifications")
public class Certification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "file_url", nullable = false)
    private String fileUrl;

    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;
}
```

### 4. CertificationRepository 생성

`/backend/src/main/java/com/localnow/user/repository/CertificationRepository.java` 신설:

```java
public interface CertificationRepository extends JpaRepository<Certification, Long> {
    List<Certification> findByUserId(Long userId);
    boolean existsByIdAndUserId(Long id, Long userId);
}
```

### 5. DTO 수정

**UserProfileResponse** (`/backend/src/main/java/com/localnow/user/dto/UserProfileResponse.java`) 에 필드 추가:
```java
String profileImageUrl,
Short birthYear,
String bio
```

**SignupRequest** (`/backend/src/main/java/com/localnow/user/dto/SignupRequest.java`) 에 선택적 필드 추가:
```java
Short birthYear,
String bio
```

**CertificationResponse** DTO 신설 (`/backend/src/main/java/com/localnow/user/dto/CertificationResponse.java`):
```java
public record CertificationResponse(
    Long id,
    String name,
    String fileUrl,
    LocalDateTime uploadedAt
) {}
```

### 6. UserService 수정

`UserService.getProfile()` 메서드가 새 필드를 포함해 반환하도록 수정.
`UserService.signup()` 메서드가 `birthYear`, `bio`를 저장하도록 수정.

## Acceptance Criteria

```bash
cd backend && ./gradlew check
```

- 컴파일 에러 없음
- 기존 테스트 전부 통과
- Flyway 마이그레이션이 `V11__guide_profile.sql`로 정상 적용됨 (bootRun 시 확인)

## 검증 절차

1. `./gradlew check` 실행 후 결과 확인
2. 아키텍처 체크:
   - DTO와 Entity가 분리되어 있는가?
   - Certification 엔티티가 `user/domain/` 패키지에 있는가?
   - Repository가 `user/repository/` 패키지에 있는가?
3. 결과에 따라 `phases/4-guide-profile-offer/index.json` 해당 step 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "V11 마이그레이션(users 컬럼 3개 + certifications 테이블), Certification 엔티티/Repository, DTO 확장 완료"`
   - 실패 3회 → `"status": "error"`, `"error_message": "구체적 에러"`

## 금지사항

- `UserProfileResponse`에 `Certification` 엔티티 객체를 직접 담지 마라. 반드시 `CertificationResponse` DTO를 사용하라.
- 기존 `languages` 필드(쉼표 구분 문자열)를 수정하지 마라. 파싱 로직은 UserService에 이미 구현되어 있다.
- `completedCount`를 User 엔티티에 추가하지 마라. 이 값은 Step 2에서 쿼리로 동적 계산한다.
