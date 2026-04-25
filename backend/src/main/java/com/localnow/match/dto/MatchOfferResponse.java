package com.localnow.match.dto;

import com.localnow.match.domain.MatchOfferStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MatchOfferResponse(
        Long id,
        Long requestId,
        Long guideId,
        String guideName,
        BigDecimal guideAvgRating,
        MatchOfferStatus status,
        String message,
        LocalDateTime createdAt
) {}
