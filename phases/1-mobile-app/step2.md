# Step 2: backend-mobile-support-and-api-layer

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/API_CONVENTIONS.md` (전체)
- `/docs/ARCHITECTURE.md` (모바일 패턴 섹션)
- `/backend/src/main/java/com/localnow/config/SecurityConfig.java`
- `/backend/src/main/java/com/localnow/config/WebSocketConfig.java`
- `/backend/src/main/java/com/localnow/request/controller/RequestController.java`
- `/backend/src/main/java/com/localnow/request/service/RequestService.java`
- `/backend/src/main/java/com/localnow/request/repository/HelpRequestRepository.java`
- `/backend/src/main/java/com/localnow/match/service/MatchService.java`
- `/backend/src/main/java/com/localnow/payment/service/PaymentService.java`
- `/backend/src/main/java/com/localnow/request/dto/` (HelpRequestResponse, CreateRequestRequest 등)
- `/backend/src/main/java/com/localnow/match/dto/` (MatchOfferResponse 등)
- `/backend/src/main/java/com/localnow/chat/dto/` (ChatRoomResponse, ChatMessageResponse)
- `/backend/src/main/java/com/localnow/payment/dto/`
- `/backend/src/main/java/com/localnow/review/dto/`
- `/mobile/src/types/api.ts` (step 1 에서 작성한 파일)
- `/mobile/src/lib/api-client.ts` (step 1 에서 작성한 파일)

## 작업

모바일 앱에서 사용하는 모든 백엔드 API 호출을 도메인별 훅/함수로 구현한다.
그 전에 모바일 앱이 실제 백엔드와 직접 통신할 수 있도록 백엔드 공식 API의 부족한 계약과 네이티브 WebSocket 엔드포인트를 보강한다.
컴포넌트는 이 훅만 사용하고 `api-client.ts` 를 직접 호출하지 않는다.

중요 원칙:
- 앱 전용 HTTP API 를 따로 만들지 않는다.
- `docs/API_CONVENTIONS.md` 의 백엔드 공식 API 를 웹과 모바일이 함께 사용한다.
- 웹 `web/src/app/api/**` Route Handler 는 같은 백엔드 API 를 proxy 하는 adapter 일 뿐이다.
- 모바일은 같은 백엔드 API 를 `mobile/src/lib/api-client.ts` 로 직접 호출한다.
- 클라이언트별 차이는 token storage(HttpOnly cookie vs SecureStore)와 WebSocket transport(`/ws` SockJS vs `/ws-native` Native WebSocket)에만 둔다.

### 0. 백엔드 공식 API 보강

#### 0-1. 가이드용 OPEN 요청 조회 API

현재 백엔드는 `GET /requests/me` 만 제공하므로 가이드가 주변/열린 요청 목록을 볼 수 없다. 이 기능은 모바일만의 요구가 아니라 웹 가이드 화면에도 필요한 백엔드 공식 계약이므로 공통 API 로 추가한다.

권장 계약:
```http
GET /requests/open?cursor={id}&size=20
Authorization: Bearer <guide-jwt>
```

- `RequestController` 에 `GET /requests/open` 추가.
- GUIDE 권한만 허용한다. TRAVELER 는 `AUTH_FORBIDDEN`.
- `RequestService` 에 `getOpenRequests(Long cursor, int size)` 추가.
- `HelpRequestRepository` 에 `status = OPEN` + cursor 기반 `id desc` 조회 메서드 추가.
- 응답은 기존 `HelpRequestPageResponse` 를 그대로 사용한다.
- 위치 반경 필터는 이번 step 에서 강제하지 않는다. Redis GEO 매칭은 요청 생성 시 알림 대상 선정에 이미 사용되며, 웹/모바일 목록은 MVP 데모 안정성을 위해 OPEN 목록으로 시작한다.

#### 0-2. CORS 설정

모바일 앱은 브라우저 CORS 제약을 직접 받지는 않지만, Expo 개발 환경과 향후 웹 확장성을 위해 명시적으로 허용한다.

`SecurityConfig` 에 `CorsConfigurationSource` Bean 을 추가하고 `filterChain` 에 `.cors(...)` 를 연결한다:
```java
@Bean
CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOriginPatterns(List.of("*"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(false);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

#### 0-3. 네이티브 WebSocket 엔드포인트

React Native 는 SockJS 를 쓰지 않으므로 순수 WebSocket 엔드포인트를 추가한다.

`WebSocketConfig`:
```java
registry.addEndpoint("/ws").withSockJS();              // 기존 웹 호환 유지
registry.addEndpoint("/ws-native").setAllowedOriginPatterns("*");
```

`SecurityConfig` 의 공개 경로에 `/ws-native/**` 도 포함한다.

#### 0-4. 조회 권한 보강

모바일 앱이 직접 백엔드를 호출하므로 조회 API의 당사자 검증을 이 step 에서 함께 보강한다.

- `MatchService.getOffers(requestId, userId, role)`: 요청 여행자 또는 해당 요청에 오퍼를 낸 가이드만 조회 가능.
- `PaymentService.getByRequestId(requestId, userId)`: payer 또는 payee 만 조회 가능.
- 실패는 `AUTH_FORBIDDEN` 으로 반환한다.

#### 0-5. 웹 BFF 매핑 확인

백엔드 공식 API 가 추가되면 웹 BFF 도 같은 계약을 proxy 하도록 맞춘다.

- 웹에서 열린 요청 목록이 필요하면 `web/src/app/api/requests/open` 같은 Route Handler 를 두고 백엔드 `GET /requests/open` 을 호출한다.
- 웹 `/api/**` 안에서 백엔드에 없는 query 조합을 임시 계약처럼 만들지 않는다.
- 모바일은 BFF 없이 `GET /requests/open` 을 직접 호출한다.

#### 0-6. 문서 계약 동기화

백엔드 계약이 바뀌므로 같은 step 에서 문서도 맞춘다.

- `docs/API_CONVENTIONS.md`: `GET /requests/open` 과 `/ws-native` 를 추가한다.
- `docs/API_CONVENTIONS.md`: 웹 BFF 와 모바일 direct call 이 같은 백엔드 endpoint 를 소비한다는 원칙을 유지한다.
- `docs/ARCHITECTURE.md`: 모바일 WebSocket 설명이 실제 `WebSocketConfig` 와 일치하는지 확인한다.
- `pr-docs/도메인` 문서가 있으면 request/chat/cross-cutting 문서에도 새 계약을 반영한다.

### 1. `mobile/src/types/api.ts` 나머지 타입 추가

step 1 에서 인증 관련 타입만 정의했다. 이 step 에서 나머지 도메인 타입을 모두 추가한다:

```typescript
// 도움 요청
interface HelpRequestResponse { id: number; travelerId: number; requestType: RequestType; lat: number; lng: number; description: string; startAt: string; durationMin: number; budgetKrw: number; status: HelpRequestStatus; createdAt: string; }
interface HelpRequestPageResponse { items: HelpRequestResponse[]; nextCursor: number | null; }
interface CreateRequestBody { requestType: RequestType; lat: number; lng: number; description: string; startAt: string; durationMin: number; budgetKrw: number; }

// 매칭 오퍼
interface MatchOfferResponse { id: number; requestId: number; guideId: number; guideName: string; guideAvgRating: number; status: MatchOfferStatus; message: string | null; createdAt: string; }

// 채팅
interface ChatRoomResponse { id: number; requestId: number; travelerId: number; guideId: number; createdAt: string; }
interface ChatMessageResponse { messageId: number; roomId: number; senderId: number; content: string; sentAt: string; clientMessageId: string; }

// 결제
interface PaymentIntentResponse { id: number; requestId: number; amountKrw: number; platformFeeKrw: number; guidePayout: number; status: PaymentStatus; createdAt: string; }

// 리뷰
interface ReviewResponse { id: number; requestId: number; reviewerId: number; revieweeId: number; rating: number; comment: string | null; createdAt: string; }

// STOMP push 이벤트 (채팅 이외)
type StompEvent =
  | { type: 'NEW_REQUEST'; requestId: number; requestType: RequestType; budgetKrw: number; }
  | { type: 'OFFER_ACCEPTED'; guideId: number; }
  | { type: 'MATCH_CONFIRMED'; requestId: number; }
  | { type: 'CHAT_MESSAGE'; roomId: number; preview: string; };
```

### 2. TanStack Query 설정

`mobile/src/lib/query-client.ts`:
```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});
```

`mobile/App.tsx` 에서 `<QueryClientProvider client={queryClient}>` 로 감싼다.

### 3. 도메인별 API 훅

`mobile/src/hooks/` 하위에 도메인별 파일로 나눈다:

#### `useRequests.ts`
```typescript
// 여행자: 내 요청 목록 (TanStack Query)
function useMyRequests(): UseQueryResult<HelpRequestPageResponse>
// 여행자: 도움 요청 생성
function useCreateRequest(): UseMutationResult<HelpRequestResponse, unknown, CreateRequestBody>
// 가이드: 열린 요청 목록
function useOpenRequests(): UseQueryResult<HelpRequestPageResponse>
```

매핑되는 백엔드 엔드포인트:
- `GET /requests/me` — 내 요청 목록
- `POST /requests` — 요청 생성
- `GET /requests/open` — 가이드용 열린 요청 목록

#### `useMatches.ts`
```typescript
function useOffers(requestId: number): UseQueryResult<MatchOfferResponse[]>
function useAcceptRequest(): UseMutationResult<MatchOfferResponse, unknown, { requestId: number; message?: string }>
function useConfirmGuide(): UseMutationResult<MatchOfferResponse, unknown, { requestId: number; guideId: number }>
```

#### `useChat.ts`
```typescript
function useChatRoom(requestId: number): UseQueryResult<ChatRoomResponse>
function useMessages(roomId: number): UseQueryResult<ChatMessageResponse[]>
```

#### `usePayment.ts`
```typescript
function useCreatePaymentIntent(): UseMutationResult<PaymentIntentResponse, unknown, { requestId: number }>
function useCapturePayment(): UseMutationResult<PaymentIntentResponse, unknown, { requestId: number }>
function usePaymentIntent(requestId: number): UseQueryResult<PaymentIntentResponse | null>
```

#### `useReview.ts`
```typescript
function useCreateReview(): UseMutationResult<ReviewResponse, unknown, { requestId: number; rating: number; comment?: string }>
```

#### `useGuide.ts`
```typescript
function useSetDuty(): UseMutationResult<void, unknown, { onDuty: boolean; lat?: number; lng?: number }>
```

### 4. 에러 처리 패턴

`api-client.ts` 는 백엔드 응답을 `ApiResponse<T>` 그대로 반환한다. 도메인 훅은 화면이 쓰기 쉬운 형태로 한 번 더 래핑한다.

- Query hook: `success: false` 이면 `throw data.error` 하여 TanStack Query 의 `error` 로 노출한다. 404 처럼 "없음"이 정상 상태인 경우에만 `null` 로 변환한다.
- Mutation hook: `success: false` 이면 `throw data.error` 한다. 성공이면 `data.data` 를 반환한다.
- 컴포넌트는 `apiFetch` 를 직접 호출하지 않고 도메인 훅의 `data`, `error`, `mutate` 만 사용한다.

모든 mutation/query 의 에러 처리는 `ApiError.code` 로 분기한다.
`INTERNAL_ERROR` 는 Alert 으로 일반 오류 메시지 표시.
`AUTH_UNAUTHENTICATED` 는 `clearToken()` 후 `RootNavigator` 리렌더링(자동 로그아웃).
이 로직은 `api-client.ts` 의 인터셉터가 아닌 각 훅 또는 화면의 명시적 분기에서 처리한다.

### 5. 테스트

`mobile/src/__tests__/api-client.test.ts`:
- 성공 응답: `{ success: true, data: {...} }` 를 그대로 반환한다.
- `requiresAuth: true` 일 때 `Authorization` 헤더가 붙는다 (fetch mock).
- 네트워크 에러 시 `INTERNAL_ERROR` 코드를 포함한 `ApiResponse` 를 반환한다.

백엔드 테스트:
- `RequestServiceTest`: `getOpenRequests` 가 `OPEN` 상태만 cursor 기반으로 반환한다.
- `MatchServiceTest`: 오퍼 목록 조회는 요청 여행자 또는 오퍼 가이드만 가능하다.
- `PaymentServiceTest`: 결제 intent 조회는 payer 또는 payee 만 가능하다.

## Acceptance Criteria

```bash
cd mobile && npm test     # api-client 테스트 포함 모든 테스트 통과
cd mobile && npm run lint # 에러 0
cd backend && ./gradlew check # 백엔드 모바일 지원 변경 검증
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `types/api.ts` 가 `API_CONVENTIONS.md` 의 모든 도메인 타입을 커버하는가?
   - 훅이 `apiFetch` 를 래핑하고, 화면 컴포넌트가 `apiFetch` 를 직접 호출하지 않는 구조인가?
   - GuideScreen 과 웹 BFF 가 함께 사용할 `GET /requests/open` 이 실제 백엔드에 존재하는가?
   - `/ws-native` 가 SockJS 없이 등록되어 있고 기존 `/ws` 는 유지되는가?
   - `docs/API_CONVENTIONS.md` 가 웹/모바일 공통 백엔드 계약을 포함하는가?
3. `phases/1-mobile-app/index.json` step 2 업데이트.

## 금지사항

- 컴포넌트 파일 안에서 API 타입을 임시 인터페이스로 재정의하지 마라. 이유: `types/api.ts` 단일 소스 원칙.
- `api-client.ts` 에 숨은 전역 인터셉터처럼 자동 로그아웃 로직을 넣지 마라. 이유: 훅과 화면의 명시적 분기가 에러 경로를 추적하기 쉽다.
- CORS 설정에서 `allowCredentials(true)` 와 `allowedOriginPatterns("*")` 를 동시에 사용하지 마라. 이유: Spring Security 가 이 조합을 거부한다.
- 기존 `web/` 의 SockJS 엔드포인트(`/ws`)를 제거하지 마라. 이유: 웹 참조 구현이 계속 사용한다.
