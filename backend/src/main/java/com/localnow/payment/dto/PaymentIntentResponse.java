package com.localnow.payment.dto;

import com.localnow.payment.domain.PaymentStatus;

import java.time.LocalDateTime;

public record PaymentIntentResponse(
        Long id,
        Long requestId,
        Long amountKrw,
        Long platformFeeKrw,
        Long guidePayout,
        PaymentStatus status,
        LocalDateTime createdAt
) {}
