package com.localnow.chat.dto;

import java.time.LocalDateTime;

public record ChatRoomSummaryResponse(
        Long roomId,
        Long requestId,
        String requestType,
        String partnerName,
        String lastMessagePreview,
        LocalDateTime lastMessageAt
) {}
