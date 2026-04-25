package com.localnow.chat.dto;

import java.time.LocalDateTime;

public record ChatMessageResponse(
        Long messageId,
        Long roomId,
        Long senderId,
        String content,
        LocalDateTime sentAt,
        String clientMessageId
) {}
