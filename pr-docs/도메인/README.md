# PR Docs

백엔드 도메인별 리뷰용 문서 모음이다. 각 문서는 실제 코드 패키지 기준으로 책임, API, 상태, 이벤트, 외부 의존성, 테스트 포인트를 정리한다.

## Backend Domains
- `backend-user.md`: 사용자, 인증, 가이드 근무 상태.
- `backend-request.md`: 도움 요청 생성, 조회, 매칭 디스패치 트리거.
- `backend-match.md`: 오퍼 수락, 매칭 확정, 채팅방 생성.
- `backend-chat.md`: 채팅방, 메시지 히스토리, STOMP 실시간 메시징.
- `backend-payment.md`: 결제 의도, 캡처, 환불, 수수료 계산.
- `backend-notification.md`: RabbitMQ 이벤트 소비와 STOMP 알림 푸시.
- `backend-review.md`: 리뷰 작성과 가이드 평점 집계.
- `backend-cross-cutting.md`: 보안, 공통 응답, WebSocket, RabbitMQ, Redis, 외부 시스템 추상화.
