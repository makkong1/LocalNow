package com.localnow.infra.pg;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MockPaymentGatewayTest {

    private MockPaymentGateway gateway;

    @BeforeEach
    void setUp() {
        gateway = new MockPaymentGateway();
    }

    @Test
    void authorize_returns_success_with_id() {
        PaymentGateway.AuthResult result = gateway.authorize(10000, "key-1");

        assertThat(result.success()).isTrue();
        assertThat(result.authorizationId()).isNotNull();
    }

    @Test
    void capture_returns_success_with_id() {
        PaymentGateway.CaptureResult result = gateway.capture("auth-id");

        assertThat(result.success()).isTrue();
        assertThat(result.captureId()).isNotNull();
    }

    @Test
    void refund_returns_success() {
        PaymentGateway.RefundResult result = gateway.refund("capture-id", 5000);

        assertThat(result.success()).isTrue();
    }

    @Test
    void setFailNext_causes_next_authorize_to_fail() {
        gateway.setFailNext(true);
        PaymentGateway.AuthResult failed = gateway.authorize(10000, "key-1");

        assertThat(failed.success()).isFalse();
        assertThat(failed.authorizationId()).isNull();
    }

    @Test
    void after_failNext_subsequent_call_succeeds() {
        gateway.setFailNext(true);
        gateway.authorize(10000, "key-1"); // consume the fail flag

        PaymentGateway.AuthResult next = gateway.authorize(10000, "key-2");
        assertThat(next.success()).isTrue();
    }

    @Test
    void setFailNext_applies_to_capture() {
        gateway.setFailNext(true);
        PaymentGateway.CaptureResult result = gateway.capture("auth-id");

        assertThat(result.success()).isFalse();
        assertThat(result.captureId()).isNull();
    }

    @Test
    void setFailNext_applies_to_refund() {
        gateway.setFailNext(true);
        PaymentGateway.RefundResult result = gateway.refund("capture-id", 5000);

        assertThat(result.success()).isFalse();
    }
}
