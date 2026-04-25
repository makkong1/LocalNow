package com.localnow.match.dto;

import jakarta.validation.constraints.NotNull;

public record ConfirmRequest(@NotNull Long guideId) {}
