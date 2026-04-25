package com.localnow.user.dto;

import jakarta.validation.constraints.NotNull;

public record DutyRequest(
        @NotNull Boolean onDuty,
        Double lat,
        Double lng
) {}
