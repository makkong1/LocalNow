package com.localnow.payment.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "payment_intents")
public class PaymentIntent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, unique = true)
    private Long requestId;

    @Column(name = "payer_id", nullable = false)
    private Long payerId;

    @Column(name = "payee_id", nullable = false)
    private Long payeeId;

    @Column(name = "amount_krw", nullable = false)
    private Long amountKrw;

    @Column(name = "platform_fee_krw", nullable = false)
    private Long platformFeeKrw;

    @Column(name = "guide_payout_krw", nullable = false)
    private Long guidePayout;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status = PaymentStatus.AUTHORIZED;

    @Column(name = "authorization_id")
    private String authorizationId;

    @Column(name = "capture_id")
    private String captureId;

    @Column(name = "idempotency_key", nullable = false, unique = true)
    private String idempotencyKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public PaymentIntent() {}

    public void capture(String captureId) {
        if (status != PaymentStatus.AUTHORIZED) {
            throw new IllegalStateException("Cannot capture from status " + status);
        }
        this.captureId = captureId;
        this.status = PaymentStatus.CAPTURED;
    }

    public void refund() {
        if (status != PaymentStatus.CAPTURED) {
            throw new IllegalStateException("Cannot refund from status " + status);
        }
        this.status = PaymentStatus.REFUNDED;
    }

    public Long getId() { return id; }
    public Long getRequestId() { return requestId; }
    public void setRequestId(Long requestId) { this.requestId = requestId; }
    public Long getPayerId() { return payerId; }
    public void setPayerId(Long payerId) { this.payerId = payerId; }
    public Long getPayeeId() { return payeeId; }
    public void setPayeeId(Long payeeId) { this.payeeId = payeeId; }
    public Long getAmountKrw() { return amountKrw; }
    public void setAmountKrw(Long amountKrw) { this.amountKrw = amountKrw; }
    public Long getPlatformFeeKrw() { return platformFeeKrw; }
    public void setPlatformFeeKrw(Long platformFeeKrw) { this.platformFeeKrw = platformFeeKrw; }
    public Long getGuidePayout() { return guidePayout; }
    public void setGuidePayout(Long guidePayout) { this.guidePayout = guidePayout; }
    public PaymentStatus getStatus() { return status; }
    public void setStatus(PaymentStatus status) { this.status = status; }
    public String getAuthorizationId() { return authorizationId; }
    public void setAuthorizationId(String authorizationId) { this.authorizationId = authorizationId; }
    public String getCaptureId() { return captureId; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
