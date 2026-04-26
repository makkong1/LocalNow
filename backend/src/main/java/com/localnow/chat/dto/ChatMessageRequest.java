package com.localnow.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ChatMessageRequest(
        @NotBlank(message = "메시지 내용을 입력하세요.")
        String content,
        @NotNull(message = "clientMessageId가 필요합니다.")
        String clientMessageId
) {}
