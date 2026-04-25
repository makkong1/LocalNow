# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`

## 작업

이 step은 백엔드와 웹의 빈 뼈대, 그리고 로컬 인프라를 모두 준비한다.
코드 한 줄도 없던 상태에서 "컴파일 통과 + 빌드 통과"가 되는 최소한의 구조를 만든다.

### 1. `docker-compose.yml` (루트)

MySQL 8, Redis 7, RabbitMQ 3(management 플러그인 포함)을 띄운다.

- MySQL: 포트 3306, DB `localnow`, 유저/비밀번호는 환경변수(`MYSQL_USER`, `MYSQL_PASSWORD`)로.
- Redis: 포트 6379, 비밀번호 없음.
- RabbitMQ: 포트 5672(AMQP), 15672(관리 UI). 기본 guest/guest.
- 모두 named volume 으로 데이터를 유지한다.

### 2. `backend/` (Spring Boot 뼈대)

#### `backend/settings.gradle`
- rootProject.name = `localnow-backend`

#### `backend/build.gradle`
Java 17 toolchain, Spring Boot 3.3.x BOM 사용. 아래 의존성을 포함한다:
- `spring-boot-starter-web`
- `spring-boot-starter-security`
- `spring-boot-starter-validation`
- `spring-boot-starter-data-jpa`
- `spring-boot-starter-data-redis`
- `spring-boot-starter-amqp`
- `spring-boot-starter-websocket`
- `spring-boot-starter-actuator`
- `mysql-connector-j` (runtime)
- `flyway-core` + `flyway-mysql`
- `jjwt-api`, `jjwt-impl`, `jjwt-jackson` (io.jsonwebtoken 0.12.x)
- `springdoc-openapi-starter-webmvc-ui` (2.x)
- 테스트: `spring-boot-starter-test`, `testcontainers` BOM, `mysql`, `redis:testcontainers`, `rabbitmq:testcontainers`

#### `backend/src/main/java/com/localnow/LocalNowApplication.java`
`@SpringBootApplication` 진입점만.

#### `backend/src/main/resources/application.yml`
실제 값은 환경변수 또는 `application-local.yml`(gitignore)에서 읽도록 placeholder 로 작성한다:
```yaml
spring:
  datasource:
    url: ${DB_URL:jdbc:mysql://localhost:3306/localnow?serverTimezone=UTC&characterEncoding=UTF-8}
    username: ${DB_USERNAME:localnow}
    password: ${DB_PASSWORD:localnow}
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true
    locations: classpath:db/migration
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
  rabbitmq:
    host: ${RABBITMQ_HOST:localhost}
    port: ${RABBITMQ_PORT:5672}
    username: ${RABBITMQ_USERNAME:guest}
    password: ${RABBITMQ_PASSWORD:guest}
jwt:
  secret: ${JWT_SECRET:please-change-this-secret-in-production}
  expiry-seconds: 86400
server:
  port: 8080
management:
  endpoints:
    web:
      exposure:
        include: health,info
```

`application-local.yml`은 만들지 않는다(gitignore 대상).

#### `backend/src/main/resources/db/migration/`
이 step에서는 마이그레이션 파일을 만들지 않는다. 도메인 step에서 각자 추가한다.
단, Flyway가 빈 migration 폴더를 오류로 처리하지 않도록 `spring.flyway.baseline-on-migrate: true`를 application.yml에 추가한다.

### 3. `web/` (Next.js 뼈대)

#### `web/package.json`
Next.js 15, React 19, TypeScript strict. 아래 의존성 포함:
- `next`, `react`, `react-dom`
- `@tanstack/react-query` (v5)
- `@stomp/stompjs`, `sockjs-client`
- `leaflet`, `react-leaflet`
- `lucide-react`
- `tailwindcss` (v4), `@tailwindcss/postcss`
- devDependencies: `typescript`, `@types/react`, `@types/node`, `@types/leaflet`, `@types/sockjs-client`, `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `eslint`, `eslint-config-next`, `playwright`

#### `web/next.config.ts`
- `output: 'standalone'` (배포 대비)
- 이미지 도메인에 OpenStreetMap 타일 서버 허용

#### `web/tailwind.config.ts`
content 경로는 `./src/**/*.{ts,tsx}`. 커스텀 색상 추가 없음 — Tailwind 기본 팔레트만 사용(UI_GUIDE.md가 임의 값을 hex로 참조하므로).

#### `web/tsconfig.json`
strict: true, paths alias `@/*` → `./src/*`.

#### `web/src/app/layout.tsx`
`<html lang="ko" className="dark">`, body에 `bg-neutral-950 text-white min-h-screen`. 폰트는 시스템 기본(커스텀 웹폰트 금지).

#### `web/src/app/page.tsx`
루트 접근 시 `/login` 으로 리다이렉트.

#### `web/src/app/globals.css`
Tailwind base/components/utilities import만.

## Acceptance Criteria

```bash
# 백엔드: 컴파일 통과
cd backend && ./gradlew compileJava

# 웹: 빌드 통과
cd web && npm install && npm run build

# 인프라: 컨테이너 기동 (Docker 실행 중이어야 함)
docker compose up -d
docker compose ps   # 3개 컨테이너 모두 healthy/running
```

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행한다.
2. 아키텍처 체크리스트:
   - `CLAUDE.md`의 패키지 루트 `com.localnow` 인가?
   - `application.yml`에 시크릿(비밀번호/JWT secret)이 하드코딩되지 않았는가?
   - `web/src/app/layout.tsx`가 UI_GUIDE.md의 배경색(`bg-neutral-950`)을 따르는가?
3. `phases/0-mvp/index.json` step 0 상태 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "docker-compose(MySQL/Redis/RabbitMQ), backend Gradle 뼈대(build.gradle+application.yml), web Next.js 뼈대 생성 완료. compileJava + npm build 통과."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적 에러>"`

## 금지사항

- `application-local.yml`을 커밋하지 마라. gitignore 대상.
- `spring.jpa.hibernate.ddl-auto=create` 또는 `create-drop`을 쓰지 마라. 이유: Flyway가 스키마를 관리한다.
- `web/` 에 `.env.local` 파일을 커밋하지 마라. gitignore 대상.
- 기존 테스트를 깨뜨리지 마라.
