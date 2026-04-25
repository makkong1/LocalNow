package com.localnow.request.dto;

import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.domain.RequestType;

import java.time.LocalDateTime;

public record HelpRequestResponse(
        Long id,
        Long travelerId,
        RequestType requestType,
        Double lat,
        Double lng,
        String description,
        LocalDateTime startAt,
        Integer durationMin,
        Long budgetKrw,
        HelpRequestStatus status,
        LocalDateTime createdAt
) {}
