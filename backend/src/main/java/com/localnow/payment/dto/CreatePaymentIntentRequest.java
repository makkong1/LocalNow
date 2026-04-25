package com.localnow.payment.dto;

import jakarta.validation.constraints.NotNull;

public record CreatePaymentIntentRequest(@NotNull Long requestId) {}
