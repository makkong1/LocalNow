package com.localnow.review.dto;

import java.time.LocalDateTime;

public record ReviewResponse(
        Long id,
        Long requestId,
        Long revieweeId,
        Integer rating,
        String comment,
        LocalDateTime createdAt
) {}
