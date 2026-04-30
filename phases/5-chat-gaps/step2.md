# Step 2: request-cancel-api

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/Users/maknkkong/project/localNow/CLAUDE.md`
- `/Users/maknkkong/project/localNow/docs/API_CONVENTIONS.md`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/controller/RequestController.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/service/RequestService.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/domain/HelpRequest.java`
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/request/domain/HelpRequestStatus.java`
- `/Users/maknkkong/project/localNow/mobile/src/types/api.ts`
- `/Users/maknkkong/project/localNow/mobile/src/lib/api-client.ts`

이전 step 1에서 수정된 파일:
- `/Users/maknkkong/project/localNow/backend/src/main/java/com/localnow/chat/controller/ChatController.java`
- `/Users/maknkkong/project/localNow/mobile/src/hooks/useChat.ts`

## 배경

`HelpRequest` 엔티티에는 `toCancelled()` 상태 전이 메서드가 구현되어 있으나, `RequestController`에 취소 엔드포인트가 없다. 여행자가 자신의 요청을 취소할 수 없는 상태다.

`toCancelled()` 가드 (현재 코드):
```java
public void toCancelled() {
    if (status == HelpRequestStatus.COMPLETED || status == HelpRequestStatus.CANCELLED) {
        throw new IllegalStateException("Cannot transition to CANCELLED from " + status);
    }
    this.status = HelpRequestStatus.CANCELLED;
}
```
즉, `OPEN`, `MATCHED`, `IN_PROGRESS` 상태에서만 취소 가능하다.

## 작업

### 1. RequestService 메서드 추가

```java
// RequestService.java
@Transactional
public void cancelRequest(@NonNull Long requestId, @NonNull Long travelerId) { ... }
```

구현 로직:
1. `requestId`로 `HelpRequest` 조회, 없으면 404
2. `travelerId`와 `request.getTravelerId()` 불일치 시 403 (`ErrorCode.AUTH_FORBIDDEN`)
3. `request.toCancelled()` 호출 — `IllegalStateException` 발생 시 409 (`PAYMENT_INVALID_STATE` 재사용 또는 새 에러코드 사용)
4. 저장

### 2. RequestController 엔드포인트 추가

```java
// RequestController.java
@DeleteMapping("/{id}")
public ResponseEntity<ApiResponse<Void>> cancelRequest(
        @PathVariable @NonNull Long id,
        Authentication authentication) { ... }
```

- TRAVELER 역할만 허용. GUIDE가 호출하면 403.
- 성공 시 `200 OK`, `ApiResponse.ok(null)` 반환.

### 3. 모바일 api-client.ts 메서드 추가

`mobile/src/lib/api-client.ts`의 `apiClient` 객체에 아래 메서드를 추가한다:

```typescript
cancelRequest(requestId: number): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/requests/${requestId}`, { method: 'DELETE' });
}
```

### 4. 테스트 작성

`backend/src/test/java/com/localnow/request/service/RequestServiceTest.java` (없으면 신규 생성)에 아래를 추가한다:

- `cancelRequest` — OPEN 상태 요청을 여행자가 취소하면 CANCELLED가 되는지 확인
- `cancelRequest` — 다른 사용자가 취소 시도 시 403 예외가 발생하는지 확인
- `cancelRequest` — COMPLETED 상태 요청 취소 시 409 예외가 발생하는지 확인

## Acceptance Criteria

```bash
cd /Users/maknkkong/project/localNow/backend
./gradlew test --tests "com.localnow.request.*"

cd /Users/maknkkong/project/localNow/mobile
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - `DELETE /requests/{id}` 엔드포인트가 존재하는가?
   - TRAVELER만 호출 가능하고, 타인 요청 취소 시 403이 반환되는가?
   - COMPLETED/CANCELLED 상태 취소 시 409가 반환되는가?
   - `apiClient.cancelRequest()` 메서드가 추가됐는가?
   - CLAUDE.md: 컨트롤러가 Repository를 직접 호출하지 않는가?
3. 결과에 따라 `phases/5-chat-gaps/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "DELETE /requests/{id} 취소 API 추가, mobile apiClient.cancelRequest() 추가, 서비스 테스트 3케이스 통과"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- GUIDE 역할에게 취소 권한을 부여하지 마라. 이유: 요청의 소유자는 여행자이며, 가이드가 취소하면 매칭 분쟁이 발생할 수 있다.
- `toCancelled()` 내부 구현을 변경하지 마라. 이유: 도메인 가드는 이미 올바르게 구현되어 있다.
- 기존 테스트를 깨뜨리지 마라.
