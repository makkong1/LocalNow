# Step 0: chatlist-error-handling

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/Users/maknkkong/project/localNow/CLAUDE.md`
- `/Users/maknkkong/project/localNow/docs/UI_GUIDE.md`
- `/Users/maknkkong/project/localNow/mobile/src/screens/ChatListScreen.tsx`
- `/Users/maknkkong/project/localNow/mobile/src/hooks/useChat.ts`
- `/Users/maknkkong/project/localNow/mobile/src/types/api.ts`

## 배경

`ChatListScreen`은 `useChatRooms()` 훅으로 `GET /chat/rooms`를 호출한다. 현재 백엔드에 이 엔드포인트가 없어 항상 오류를 반환하지만, 화면은 `isError`를 처리하지 않는다. 그 결과 API 오류가 발생해도 사용자에게 "확정된 매칭이 없습니다"로 표시된다. 오류와 실제 빈 목록을 구분할 방법이 없는 상태다.

## 작업

### 1. `ChatListScreen.tsx` 수정

`mobile/src/screens/ChatListScreen.tsx`의 `useChatRooms()` 호출부에 `isError` 분기를 추가한다.

```typescript
const { data: rooms, isLoading, isError } = useChatRooms();
```

오류 상태일 때 표시할 UI를 추가한다. 디자인 원칙(다크 테마, amber 포인트)을 따른다:
- 에러 메시지 텍스트: "채팅 목록을 불러오지 못했습니다"
- `testID="chat-list-error"` 부여
- 재시도 버튼은 선택 사항 (있으면 `refetch()` 호출)

분기 순서: `isLoading` → `isError` → `!rooms || rooms.length === 0` → 목록 렌더링

### 2. 테스트 작성

`mobile/src/__tests__/ChatListScreen.test.tsx` (없으면 신규 생성)에 아래 케이스를 추가한다:

- `useChatRooms`가 로딩 중일 때 `ActivityIndicator` 렌더링 확인
- `useChatRooms`가 오류를 반환할 때 `testID="chat-list-error"` 엘리먼트 렌더링 확인
- `useChatRooms`가 빈 배열을 반환할 때 `testID="empty-chat-list"` 엘리먼트 렌더링 확인
- `useChatRooms`가 데이터를 반환할 때 첫 번째 방 row 렌더링 확인

테스트에서 `useChatRooms`는 `jest.mock`으로 모킹한다. `@tanstack/react-query` 전체를 모킹하지 말고 `../hooks/useChat` 모듈만 모킹할 것.

## Acceptance Criteria

```bash
cd /Users/maknkkong/project/localNow/mobile
npm test -- --testPathPattern="ChatListScreen" --watchAll=false
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - `isLoading` / `isError` / 빈 목록 / 데이터 4가지 분기가 모두 존재하는가?
   - `testID="chat-list-error"` 엘리먼트가 있는가?
   - 다크 테마(`#0a0a0a` 배경, amber 포인트 컬러) 스타일이 유지되는가?
   - CLAUDE.md: 컴포넌트 안에 임시 API 타입 재정의 없는가?
3. 결과에 따라 `phases/5-chat-gaps/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "ChatListScreen에 isError 분기 추가, 테스트 4케이스 통과"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`

## 금지사항

- `AsyncStorage`에 토큰을 저장하지 마라. 이유: CLAUDE.md CRITICAL — JWT는 expo-secure-store에만 저장.
- `useChatRooms` 훅의 내부 구현을 변경하지 마라. 이유: 이 step의 scope는 ChatListScreen UI 레이어만이다.
- 기존 테스트를 깨뜨리지 마라.
