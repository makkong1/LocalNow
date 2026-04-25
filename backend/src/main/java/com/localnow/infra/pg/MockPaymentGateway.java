package com.localnow.infra.pg;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

@Primary
@Component
public class MockPaymentGateway implements PaymentGateway {

    private final AtomicBoolean failNext = new AtomicBoolean(false);

    public void setFailNext(boolean fail) {
        failNext.set(fail);
    }

    @Override
    public AuthResult authorize(long amountKrw, String idempotencyKey) {
        if (failNext.getAndSet(false)) {
            return new AuthResult(null, false);
        }
        return new AuthResult(UUID.randomUUID().toString(), true);
    }

    @Override
    public CaptureResult capture(String authorizationId) {
        if (failNext.getAndSet(false)) {
            return new CaptureResult(null, false);
        }
        return new CaptureResult(UUID.randomUUID().toString(), true);
    }

    @Override
    public RefundResult refund(String captureId, long amountKrw) {
        if (failNext.getAndSet(false)) {
            return new RefundResult(false);
        }
        return new RefundResult(true);
    }
}
