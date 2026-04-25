package com.localnow.infra.pg;

public interface PaymentGateway {

    AuthResult authorize(long amountKrw, String idempotencyKey);

    CaptureResult capture(String authorizationId);

    RefundResult refund(String captureId, long amountKrw);

    record AuthResult(String authorizationId, boolean success) {}

    record CaptureResult(String captureId, boolean success) {}

    record RefundResult(boolean success) {}
}
