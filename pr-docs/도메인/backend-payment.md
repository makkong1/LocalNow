# Backend Domain: Payment

## 역할
`payment` 도메인은 매칭된 요청의 결제 의도 생성, 캡처, 환불, 수수료 계산을 담당한다. MVP에서는 실제 PG 연동 대신 `MockPaymentGateway`를 사용한다.

## 주요 코드
- Controller: `backend/src/main/java/com/localnow/payment/controller/PaymentController.java`
- Service: `backend/src/main/java/com/localnow/payment/service/PaymentService.java`
- Domain: `backend/src/main/java/com/localnow/payment/domain/PaymentIntent.java`
- Domain: `backend/src/main/java/com/localnow/payment/domain/PaymentStatus.java`
- Repository: `backend/src/main/java/com/localnow/payment/repository/PaymentIntentRepository.java`
- DTO: `CreatePaymentIntentRequest`, `PaymentIntentResponse`
- Infra: `backend/src/main/java/com/localnow/infra/pg/PaymentGateway.java`
- Infra: `backend/src/main/java/com/localnow/infra/pg/MockPaymentGateway.java`

## API
| Method | Path | Auth | 설명 |
| --- | --- | --- | --- |
| `POST` | `/payments/intent` | TRAVELER | 요청에 대한 결제 의도를 생성한다. |
| `POST` | `/payments/{requestId}/capture` | TRAVELER | 결제를 캡처하고 요청을 완료 처리한다. |
| `POST` | `/payments/{requestId}/refund` | TRAVELER | 캡처된 결제를 환불한다. |
| `GET` | `/payments/{requestId}` | TRAVELER | 요청의 결제 의도를 조회한다. |

## 상태
| Status | 의미 |
| --- | --- |
| `AUTHORIZED` | 결제 의도가 승인된 상태. |
| `CAPTURED` | 결제 캡처가 완료된 상태. |
| `REFUNDED` | 환불이 완료된 상태. |
| `FAILED` | 결제 실패 상태. |

## 도메인 규칙
- 결제 의도는 `MATCHED` 상태의 요청에 대해서만 생성한다.
- 요청의 여행자만 결제 의도를 생성하고 캡처할 수 있어야 한다.
- 같은 `requestId`로 결제 의도 생성을 재호출하면 기존 intent를 반환한다.
- 멱등키는 `payment:{requestId}` 형식을 사용한다.
- 캡처 성공 시 `request` 도메인의 요청 상태를 `COMPLETED`로 전이한다.
- 환불은 `CAPTURED` 상태에서만 가능하다.
- 결제 상태 전이는 `PaymentIntent` 엔티티 메서드에서 검증한다.

## 수수료
| Request Type | Fee Rate |
| --- | --- |
| `EMERGENCY` | 25% |
| 그 외 | 15% |

수수료는 정수 연산으로 계산한다. 문서 계약 기준 계산식은 `(amountKrw * rate + 50) / 100`이다.

## 외부 의존성
- `infra/pg/PaymentGateway`: PG 추상화.
- `infra/pg/MockPaymentGateway`: MVP용 Fake PG 구현.
- `request` 도메인: 요청 상태와 소유자 검증, 완료 상태 전이.

## 테스트 포인트
- `MATCHED`가 아닌 요청에는 intent를 만들 수 없다.
- 같은 요청에 intent가 중복 생성되지 않는다.
- 캡처 성공 시 결제 상태와 요청 상태가 함께 전이된다.
- `AUTHORIZED -> CAPTURED -> REFUNDED` 외의 상태 전이는 거절된다.
