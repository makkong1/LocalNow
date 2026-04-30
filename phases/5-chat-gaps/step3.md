# Step 3: in-progress-cleanup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/Users/maknkkong/project/localNow/CLAUDE.md`
- `/Users/maknkkong/project/localNow/docs/API_CONVENTIONS.md`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/domain/HelpRequestStatus.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/service/RequestService.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/controller/RequestController.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/payment/service/PaymentService.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/match/service/MatchService.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/notification/listener/MatchNotificationListener.java`
- `/Users/maknkkong/project/localNow/mobile/src/types/api.ts`

이전 step 2에서 수정된 파일:
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/service/RequestService.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/controller/RequestController.java`

## 배경

현재 `HelpRequestStatus`에는 `IN_PROGRESS` 상태가 있고 `HelpRequest.toInProgress()` 메서드도 구현되어 있지만, 이 메서드를 호출하는 코드가 백엔드 어디에도 없다. `PaymentService.capture()`는 `MATCHED` → `COMPLETED`로 직접 전이한다. 이 상태의 용도를 확정하고 코드를 정리해야 한다.

또한 `MatchNotificationListener`는 `match.offer.created` 라우팅 키를 처리하는데, 이 이벤트를 발행하는 코드가 탐색된 파일 내에 없어 동작 여부가 불확실하다.

## 작업

### 1. MatchDispatcher 확인 및 `match.offer.created` 발행 검증

`backend/src/main/java/com/localnow/match/` 또는 `infra/` 하위에서 `MatchDispatcher` 또는 `MatchDispatchEvent`를 처리하는 리스너/핸들러를 찾아라.

- `match.offer.created`를 발행하는 코드가 존재하면: 동작 확인 후 아래 `IN_PROGRESS` 작업만 수행한다.
- 발행하는 코드가 없으면: `MatchNotificationListener.handleOfferCreated()` 메서드에 `// TODO: match.offer.created is currently unpublished — wire up in MatchDispatcher` 주석을 추가하고 step index를 blocked가 아닌 completed로 기록하되 summary에 해당 사실을 명시한다.

### 2. `IN_PROGRESS` 상태 결정 및 구현

`PaymentService.capture()` 흐름을 분석하면 현재 `MATCHED → COMPLETED`로 직접 전이한다. "서비스 시작"을 별도 이벤트로 표현하려면 `MATCHED → IN_PROGRESS → COMPLETED` 흐름이 필요하다.

**아래 방향으로 구현하라:**

`POST /requests/{id}/start` 엔드포인트를 추가해 가이드가 현장 도착 후 서비스 시작을 명시적으로 알릴 수 있도록 한다.

**RequestService에 메서드 추가:**

```java
@Transactional
public HelpRequestResponse startRequest(@NonNull Long requestId, @NonNull Long guideId) { ... }
```

구현 로직:
1. `requestId`로 `HelpRequest` 조회, 없으면 404
2. 해당 요청에 `guideId`가 CONFIRMED 오퍼를 가진 가이드인지 확인, 아니면 403
3. `request.toInProgress()` 호출
4. 저장 후 반환

**RequestController에 엔드포인트 추가:**

```java
@PostMapping("/{id}/start")
public ResponseEntity<ApiResponse<HelpRequestResponse>> startRequest(
        @PathVariable @NonNull Long id,
        Authentication authentication) { ... }
```

- GUIDE 역할만 허용.

### 3. `PaymentService.capture()` 가드 보강

현재 `capture()`는 `MATCHED` 상태에서 바로 `toCompleted()`를 호출한다. `IN_PROGRESS` 경로가 생겼으므로, 이미 `toCompleted()` 가드 자체가 `MATCHED`와 `IN_PROGRESS` 양쪽을 허용하고 있어 코드 변경 없이 양립 가능하다. 단, 주석으로 의도를 명확히 한다:

```java
// capture() 내부
// Allows both MATCHED→COMPLETED (legacy) and IN_PROGRESS→COMPLETED (after /start called)
request.toCompleted();
```

### 4. 테스트 작성

`backend/src/test/java/com/localnow/request/service/RequestServiceTest.java`에 추가:

- `startRequest` — MATCHED 상태 요청을 해당 가이드가 시작하면 IN_PROGRESS가 되는지 확인
- `startRequest` — 다른 가이드가 시작 시도 시 403 예외가 발생하는지 확인
- `startRequest` — OPEN 상태 요청 시작 시도 시 예외가 발생하는지 확인

## Acceptance Criteria

```bash
cd /Users/maknkkong/project/localNow/backend
./gradlew test --tests "com.localnow.request.*"
./gradlew check
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - `POST /requests/{id}/start` 엔드포인트가 존재하고 GUIDE만 호출 가능한가?
   - `MATCHED → IN_PROGRESS → COMPLETED` 전이가 가능한가?
   - `match.offer.created` 발행자 확인 결과가 summary에 기록됐는가?
   - CLAUDE.md: 컨트롤러가 Repository를 직접 호출하지 않는가?
3. 결과에 따라 `phases/5-chat-gaps/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "POST /requests/{id}/start 추가로 IN_PROGRESS 전이 완성, match.offer.created 발행자 확인 결과: [발견/미발견]"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `HelpRequestStatus` enum에서 `IN_PROGRESS`를 제거하지 마라. 이유: DB에 이미 스키마가 있고, 이번 step에서 실제로 사용하도록 구현한다.
- `PaymentService.capture()`의 `toCompleted()` 호출을 제거하거나 조건부로 바꾸지 마라. 이유: 결제 캡처 시 자동 완료 흐름은 유지되어야 한다. `start` API 호출 없이도 결제가 완료되면 COMPLETED가 된다.
- 기존 테스트를 깨뜨리지 마라.
