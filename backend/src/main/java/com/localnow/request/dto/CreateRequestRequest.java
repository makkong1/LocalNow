package com.localnow.request.dto;

import com.localnow.request.domain.RequestType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public record CreateRequestRequest(
        @NotNull RequestType requestType,
        @NotNull Double lat,
        @NotNull Double lng,
        String description,
        @NotNull LocalDateTime startAt,
        @NotNull Integer durationMin,
        @NotNull @Min(0) Long budgetKrw
) {}
