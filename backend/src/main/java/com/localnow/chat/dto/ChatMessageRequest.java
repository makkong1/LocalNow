package com.localnow.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ChatMessageRequest(
        @NotBlank String content,
        @NotNull String clientMessageId
) {}
