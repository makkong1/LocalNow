package com.localnow.chat.dto;

import java.time.LocalDateTime;

public record ChatRoomResponse(
        Long id,
        Long requestId,
        Long travelerId,
        Long guideId,
        LocalDateTime createdAt
) {}
