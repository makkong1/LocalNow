# API 규약 가이드

LocalNow 백엔드의 단일 공식 외부 계약 문서. 소비자는 (1) Next.js 데모 웹(`web/src/app/api/**` Route Handler 를 통해) 과 (2) 모바일 앱(`mobile/src/lib/api-client.ts` 로 직접 호출)이다. 웹의 `web/src/types/api.ts` 와 모바일의 `mobile/src/types/api.ts` 는 이 문서와 1:1 로 대응한다.

## 설계 원칙
1. **일관된 응답 봉투** — 모든 응답은 공통 타입 `ApiResponse<T>` 로 감싸서 내려준다. 성공/실패 모두 동일한 구조를 유지한다.
2. **에러는 enum 으로 타입화** — 프리 텍스트 에러 메시지로 분기하지 않는다. 클라이언트는 `code` 로 분기한다.
3. **URL 은 리소스 단수/복수 구분** — 컬렉션은 복수(`/requests`), 단건은 `/requests/{id}`. 동사는 URL 에 넣지 않는다. 상태 변경이 필요한 경우에만 sub-resource (`/requests/{id}/confirm`) 또는 PATCH 를 쓴다.
4. **페이징은 Cursor 기반** — offset 페이징은 금지한다. 응답에 `nextCursor` 를 넣고, null 이면 마지막 페이지.
5. **시간은 항상 UTC ISO-8601** — `2026-04-22T12:00:00Z`. 타임존은 클라이언트가 변환한다.
6. **돈은 정수 최소 통화 단위** — 원화는 KRW 단위 정수, USD 는 cents 정수. Double 금지.
7. **웹/모바일 API 계약은 하나** — 백엔드 HTTP API 는 클라이언트별로 나누지 않는다. 웹 Route Handler 는 인증 쿠키를 백엔드 Bearer token 호출로 바꾸는 얇은 BFF/proxy 이고, 모바일은 같은 백엔드 API 를 직접 호출한다.
8. **클라이언트 차이는 transport 와 token storage 에만 둔다** — 웹은 HttpOnly cookie + BFF, 모바일은 SecureStore + direct Bearer 호출을 쓴다. HTTP resource, DTO, error code 는 동일해야 한다.

## 클라이언트별 호출 경로

| 클라이언트 | HTTP 호출 경로 | 토큰 보관 | 백엔드 계약 |
|------------|----------------|-----------|-------------|
| Web | Browser → `web/src/app/api/**` → Backend | HttpOnly cookie | 이 문서의 endpoint 를 Route Handler 가 proxy |
| Mobile | App → Backend | `expo-secure-store` | 이 문서의 endpoint 를 직접 호출 |

웹의 `/api/**` 경로는 백엔드 API 를 새로 정의하지 않는다. 예를 들어 웹 `GET /api/requests` 가 내부적으로 백엔드 `GET /requests/me` 를 호출한다면, 공식 계약은 `GET /requests/me` 이다. 웹과 모바일 중 한쪽에서 필요한 데이터가 있으면 BFF 안에서 임시로 우회하지 말고 백엔드 공식 endpoint 를 먼저 확정한다.

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
| `NOT_FOUND` | 404 | 존재하지 않는 정적 리소스 또는 라우트 |
| `OPTIMISTIC_LOCK_CONFLICT` | 409 | 낙관적 락 충돌, 재조회 후 재시도 필요 |
| `INTERNAL_ERROR` | 500 | 기타 서버 오류 (로그에 stack, 응답에는 코드만) |

## 엔드포인트 목록

### 인증 (`/auth`, OAuth2)
| 메서드 | 경로 | 역할 | 설명 |
|--------|------|------|------|
| POST | `/auth/signup` | 공개 | 이메일/비밀번호 회원가입. body: `{email, password, name, role, city}`. `role: ADMIN` 은 거부(403) |
| POST | `/auth/login` | 공개 | 로그인 → `{accessToken, userId, role, name}` 반환 |
| GET  | `/auth/me` | 인증 | 현재 사용자 프로필 조회 |
| GET  | `/oauth2/authorization/google` | 공개 | Google OAuth2 로그인 시작 → Google 인증 페이지로 302 리다이렉트 |
| GET  | `/login/oauth2/code/google` | 공개 | Google OAuth2 콜백. 성공 시 `{successRedirect}#access_token={jwt}` 로 302 리다이렉트. 실패 시 `{failureRedirect}?oauth2Error={msg}` |

> OAuth2 로그인 성공 후 fragment(`#access_token=...`)에 JWT 가 담긴다. 클라이언트는 fragment 를 파싱해 토큰을 꺼낸 뒤 `Authorization: Bearer` 로 API 를 호출한다. redirect URL 은 환경변수 `OAUTH2_SUCCESS_REDIRECT_URL` / `OAUTH2_FAILURE_REDIRECT_URL` 로 설정한다 (기본값: `http://localhost:3000/oauth/callback`).

### 관리자 (`/admin`) — 읽기 전용 집계 (ADR-014)
| 메서드 | 경로 | 역할 | 설명 |
|--------|------|------|------|
| GET | `/admin/summary` | ADMIN | 사용자 수·`HelpRequest` 상태별 건수 집계 |

### 도움 요청 (`/requests`)
| 메서드 | 경로 | 역할 | 설명 |
|--------|------|------|------|
| POST | `/requests` | TRAVELER | 요청 생성. body: `{requestType, lat, lng, description, startAt, durationMin, budgetKrw}` |
| GET  | `/requests/me` | 인증 | 여행자 기준 “내 요청”. `travelerId = sub` 로 필터 — 가이드 토큰이면 보통 빈 목록(403 은 하지 않음) |
| GET  | `/requests/open` | GUIDE | `OPEN` 상태 요청만 cursor 페이징 |
| GET  | `/requests/{id}` | 인증 | 요청 단건. TRAVELER=본인만, GUIDE=OPEN 이거나 본인이 offer 를 낸 경우 |
| POST | `/requests/{id}/accept` | GUIDE | 요청 수락. body: `{message?}`. 멱등 — 동일 guideId 재호출 시 기존 offer 반환 |
| POST | `/requests/{id}/confirm` | TRAVELER | 가이드 1명 확정. body: `{guideId}`. Redis 분산락으로 중복 확정 차단 |
| GET  | `/requests/{id}/offers` | 인증 | TRAVELER=해당 요청의 traveler 만, GUIDE=OPEN 이거나 본인이 offer 를 낸 경우 |
| GET  | `/requests/{id}/room` | 인증 | 매칭된 채팅방 조회 |
| POST | `/requests/{id}/review` | TRAVELER | 리뷰 작성 (요청이 COMPLETED 상태일 때). body: `{rating, comment?}` |

### 매칭 (`/requests` 하위, match 도메인 처리)
`/requests/{id}/accept` 와 `/requests/{id}/confirm` 참조. 별도 `/matches` 경로 없음.

### 채팅 (`/rooms`)
| 메서드 | 경로 | 역할 | 설명 |
|--------|------|------|------|
| GET | `/rooms/{roomId}/messages` | 인증(방 참여자) | 메시지 히스토리 (cursor 페이징) |

STOMP 실시간 채널은 아래 "WebSocket (STOMP) 채널 규약" 참조.

### 결제 (`/payments`)
| 메서드 | 경로 | 역할 | 설명 |
|--------|------|------|------|
| POST | `/payments/intent` | TRAVELER | 결제 의도 생성. body: `{requestId}`. 멱등 — 같은 requestId 재호출 시 기존 intent 반환 |
| POST | `/payments/{requestId}/capture` | TRAVELER | 결제 캡처. 성공 시 HelpRequest → COMPLETED 전이 |
| POST | `/payments/{requestId}/refund` | TRAVELER | 환불 (CAPTURED → REFUNDED) |
| GET  | `/payments/{requestId}` | TRAVELER/GUIDE | 결제 의도 조회. payer(payerId) 또는 payee(payeeId=가이드) 본인만 |

수수료율: EMERGENCY 25%, 그 외 15%. 계산은 정수 반올림: `(amountKrw × rate + 50) / 100`.

### 리뷰 (`/users`)
| 메서드 | 경로 | 역할 | 설명 |
|--------|------|------|------|
| GET | `/users/{userId}/reviews` | 공개 | 가이드 리뷰 목록 (cursor 페이징) |

### 가이드 위치 (`/guide`)
| 메서드 | 경로 | 역할 | 설명 |
|--------|------|------|------|
| POST | `/guide/duty` | GUIDE | on-duty 토글. body: `{onDuty: boolean, lat?, lng?}`. onDuty=true 시 lat/lng 필수 → Redis GEO 등록; false → 삭제 |

## 네이밍 규칙
- JSON 필드: camelCase (`helpRequestId`, `createdAt`).
- URL 세그먼트: kebab-case 는 쓰지 않는다. 단수/복수 영단어만 사용한다 (`/help-requests` 금지 → `/requests`).
- enum 값: UPPER_SNAKE_CASE (`GUIDE`, `TRANSLATION`, `EMERGENCY`).
- ID: 외부에 숫자 PK 를 그대로 노출해도 된다 (MVP). UUID 로 바꿀 필요가 생기면 ADR 추가.

## WebSocket (STOMP) 채널 규약

WebSocket (STOMP) 엔드포인트 (동일 STOMP destination):

- `ws://{host}/ws` — 브라우저용 SockJS 폴백 (`/ws/websocket` 등).
- `ws://{host}/ws-native` — 모바일/네이티브 WebSocket (SockJS 없음).

CONNECT 시 `Authorization: Bearer <token>` 헤더 필수. SUBSCRIBE 는 destination 별로 JWT subject 와 topic id 가 일치할 때만 허용(`ChatChannelInterceptor`).

### 채팅 채널
- **SUBSCRIBE** `/topic/rooms/{roomId}` — 해당 방 참여자만 구독 가능 (`ChatChannelInterceptor` 에서 JWT + 방 참여 여부 체크).
- **SEND** `/app/rooms/{roomId}/messages` — 페이로드:
```json
{ "content": "...", "clientMessageId": "uuid-v4" }
```
- 서버 → 클라이언트 푸시:
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

### 실시간 알림 채널
RabbitMQ 이벤트를 소비한 `notification` 도메인이 STOMP 로 push 한다. **구독은 인증 + destination 권한 검사** (JWT `sub` 와 `guideId`/`userId` 일치, `/topic/requests/{requestId}` 는 traveler 또는 허용된 guide 만).

| 구독 경로 | 수신 대상 | 페이로드 예시 |
|-----------|-----------|--------------|
| `/topic/guides/{guideId}` | GUIDE | `{ "type": "NEW_REQUEST", "requestId": 1, "requestType": "GUIDE", "budgetKrw": 30000 }` |
| `/topic/guides/{guideId}` | GUIDE | `{ "type": "MATCH_CONFIRMED", "requestId": 1 }` |
| `/topic/requests/{requestId}` | TRAVELER | `{ "type": "OFFER_ACCEPTED", "guideId": 20 }` |
| `/topic/users/{userId}` | 모든 사용자 | `{ "type": "CHAT_MESSAGE", "roomId": 5, "preview": "안녕하세요 (30자 이내)" }` |

`type` 필드로 이벤트 종류를 구분한다. 클라이언트는 알 수 없는 `type` 은 무시한다.

## 보안 규칙
- 인증: `Authorization: Bearer <jwt>`. JWT payload 에는 `sub`(userId), `role`, `exp` 만 넣는다. PII 금지.
- **역할**: Spring Security 에는 `authorities` 로 `ROLE_TRAVELER`, `ROLE_GUIDE`, (관리자) `ROLE_ADMIN` 이 올라간다. 엔드포인트 목록의 **역할** 열이 `TRAVELER` / `GUIDE` 인 경우, 컨트롤러에서 해당 권한이 없으면 HTTP **403** + `error.code = AUTH_FORBIDDEN` 이다. `인증` 만 표기된 경로는 두 역할 모두 호출할 수 있으나, 단건 조회·목록은 **서비스**에서 traveler/guide 본인·OPEN 조건 등 리소스 단위로 한 번 더 검증한다.
- **공통 매핑**: `com.localnow.common.security.AuthenticationUserRoles` 가 `Authentication` 기준으로 `isTraveler` / `isGuide` / `resolveUserRole`(TRAVELER·GUIDE 구분이 필요한 조회) 을 제공한다. 복제된 문자열 리터럴 대신 이 유틸을 쓴다.
- 모든 엔드포인트는 기본 인증 필수. 공개 경로: `/auth/**`, `/oauth2/**`, `/login/oauth2/**`, `/actuator/health`, `/actuator/info`, `/swagger-ui/**`, `/v3/api-docs/**`, `/ws/**`, `/ws-native/**`, `/error`.
- 로그에 개인정보(비밀번호, 토큰, 전체 이메일)를 찍지 않는다.

## 문서화
- 컨트롤러는 `springdoc-openapi` 로 OpenAPI 스펙을 자동 생성하고, `/swagger-ui.html` 로 노출한다.
- 응답 예시는 `@Schema(example = "...")` 로 최소 하나씩 둔다.
