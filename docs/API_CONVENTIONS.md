# API 규약 가이드

LocalNow 서버의 외부 계약 문서. 소비자는 (1) Next.js 데모 웹(`web/src/app/api/**` Route Handler 를 통해) 과 (2) 향후 모바일 앱이다. 웹의 `web/src/types/api.ts` 는 이 문서와 1:1 로 대응한다.

## 설계 원칙
1. **일관된 응답 봉투** — 모든 응답은 공통 타입 `ApiResponse<T>` 로 감싸서 내려준다. 성공/실패 모두 동일한 구조를 유지한다.
2. **에러는 enum 으로 타입화** — 프리 텍스트 에러 메시지로 분기하지 않는다. 클라이언트는 `code` 로 분기한다.
3. **URL 은 리소스 단수/복수 구분** — 컬렉션은 복수(`/requests`), 단건은 `/requests/{id}`. 동사는 URL 에 넣지 않는다. 상태 변경이 필요한 경우에만 sub-resource (`/requests/{id}/confirm`) 또는 PATCH 를 쓴다.
4. **페이징은 Cursor 기반** — offset 페이징은 금지한다. 응답에 `nextCursor` 를 넣고, null 이면 마지막 페이지.
5. **시간은 항상 UTC ISO-8601** — `2026-04-22T12:00:00Z`. 타임존은 클라이언트가 변환한다.
6. **돈은 정수 최소 통화 단위** — 원화는 KRW 단위 정수, USD 는 cents 정수. Double 금지.

## 공통 응답 포맷
성공:
```json
{
  "success": true,
  "data": { "...": "..." },
  "error": null,
  "meta": { "requestId": "..." }
}
```

실패:
```json
{
  "success": false,
  "data": null,
  "error": { "code": "REQUEST_NOT_FOUND", "message": "...", "fields": null },
  "meta": { "requestId": "..." }
}
```

- HTTP 상태코드도 의미에 맞게 사용한다. 2xx 는 성공, 4xx 는 클라이언트 오류, 5xx 는 서버 오류.
- 검증 실패는 `422 Unprocessable Entity` + `error.code = "VALIDATION_FAILED"` + `error.fields` 에 필드별 메시지 배열.

## 에러 코드
`common/ErrorCode.java` 에 enum 으로 정의. 이름은 `<DOMAIN>_<REASON>` 패턴.

| 코드 | HTTP | 설명 |
|------|------|------|
| `AUTH_UNAUTHENTICATED` | 401 | 토큰 없음/만료 |
| `AUTH_FORBIDDEN` | 403 | 권한 부족 |
| `VALIDATION_FAILED` | 422 | 입력 검증 실패 |
| `REQUEST_NOT_FOUND` | 404 | 도움 요청 없음 |
| `REQUEST_NOT_OPEN` | 409 | 이미 확정/취소된 요청에 대한 수락/확정 시도 |
| `MATCH_ALREADY_CONFIRMED` | 409 | 동시 확정 시 나머지 후보가 받는 코드 |
| `PAYMENT_INVALID_STATE` | 409 | 결제 상태 머신 위반 |
| `RATE_LIMITED` | 429 | 호출 제한 |
| `INTERNAL_ERROR` | 500 | 기타 서버 오류 (로그에 stack, 응답에는 코드만) |

## 네이밍 규칙
- JSON 필드: camelCase (`helpRequestId`, `createdAt`).
- URL 세그먼트: kebab-case 는 쓰지 않는다. 단수/복수 영단어만 사용한다 (`/help-requests` 금지 → `/requests`).
- enum 값: UPPER_SNAKE_CASE (`GUIDE`, `TRANSLATION`, `EMERGENCY`).
- ID: 외부에 숫자 PK 를 그대로 노출해도 된다 (MVP). UUID 로 바꿀 필요가 생기면 ADR 추가.

## WebSocket (STOMP) 채널 규약
- SUBSCRIBE: `/topic/rooms/{roomId}` — 해당 방 참여자만 구독 가능 (`ChannelInterceptor` 에서 권한 체크).
- SEND: `/app/rooms/{roomId}/messages` — 페이로드는 아래 구조.
```json
{ "content": "...", "clientMessageId": "uuid-v4" }
```
- 서버 → 클라이언트 메시지:
```json
{
  "messageId": 123,
  "roomId": 456,
  "senderId": 789,
  "content": "...",
  "sentAt": "2026-04-22T12:00:00Z",
  "clientMessageId": "uuid-v4"
}
```
- `clientMessageId` 는 재전송 시 중복 저장을 막기 위한 멱등키이다. 서버는 동일 `(roomId, senderId, clientMessageId)` 가 이미 있으면 기존 메시지를 반환한다.

## 보안 규칙
- 인증: `Authorization: Bearer <jwt>`. JWT payload 에는 `sub`(userId), `role`, `exp` 만 넣는다. PII 금지.
- 모든 엔드포인트는 기본 인증 필수. 명시적으로 `/auth/**`, `/actuator/health` 만 공개.
- 로그에 개인정보(비밀번호, 토큰, 전체 이메일)를 찍지 않는다.

## 문서화
- 컨트롤러는 `springdoc-openapi` 로 OpenAPI 스펙을 자동 생성하고, `/swagger-ui.html` 로 노출한다.
- 응답 예시는 `@Schema(example = "...")` 로 최소 하나씩 둔다.
