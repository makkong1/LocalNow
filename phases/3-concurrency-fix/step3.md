# Step 3: match-confirm-lock-ttl

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/backend/src/main/java/com/localnow/match/service/MatchService.java`
- `/backend/src/main/resources/application.yml`
- `/pr-docs/backend-concurrency-and-transactions.md` (§2 락 TTL·운영 메모)

## 문제

`MatchService.confirm()`의 Redis 분산 락 TTL이 코드에 `5, TimeUnit.SECONDS`로 하드코딩되어 있다. 운영에서 P99 트랜잭션이 길어지면 TTL 만료 후 경합이 생길 수 있고, 환경별로 조정할 수 없다.

## 작업

### 1. 설정 추가 (`application.yml`)

`app` 섹션에 다음을 추가한다:

- `app.match.confirm-lock-ttl`: 기본값 `5s`, 환경변수 `MATCH_CONFIRM_LOCK_TTL`로 덮어쓰기 가능 (Spring `Duration` 형식: `5s`, `15s`, `PT15S` 등).

### 2. `MatchService` 수정

- 생성자 주입으로 `Duration confirmLockTtl`을 받는다 (`@Value("${app.match.confirm-lock-ttl:5s}")`).
- TTL이 `0` 이하이면 `IllegalArgumentException`으로 기동 실패(잘못된 운영 설정 조기 발견).
- `setIfAbsent(lockKey, lockValue, confirmLockTtl)` 오버로드 사용 (`TimeUnit` 상수 제거).
- 락 미획득 시 `log.warn`에 `requestId`, `lockKey`, `ttl` 포함(모니터링·트러블슈팅).
- `@RequiredArgsConstructor` 제거 시 기존 필드 순서 유지, 테스트 `new MatchService(..., Duration)` 갱신.

### 3. 테스트

- `MatchServiceTest`: `confirm_passes_configured_ttl_to_redis_setIfAbsent` — `setIfAbsent(..., eq(Duration.ofSeconds(5)))` 검증(락 실패로 조기 종료).
- 기존 테스트 컴파일·통과 유지.

## Acceptance Criteria

```bash
cd backend && ./gradlew test --tests "com.localnow.match.service.MatchServiceTest" --no-daemon
cd backend && ./gradlew compileJava --no-daemon
```

## 검증 절차

1. AC 실행.
2. `application.yml`에 `app.match.confirm-lock-ttl` / `MATCH_CONFIRM_LOCK_TTL` 설명이 있는지 확인.
3. `phases/3-concurrency-fix/index.json` step 3을 `completed` + summary 갱신.

## 금지사항

- `confirm()`의 비즈니스 로직·Redis Lua 해제 스크립트는 변경하지 마라. TTL 주입·로깅·설정만.
- `MATCH_CONFIRM_LOCK_TTL`에 비밀 값을 넣지 마라(공개 설정).
