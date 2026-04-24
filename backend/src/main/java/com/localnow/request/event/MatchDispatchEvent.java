package com.localnow.request.event;

public record MatchDispatchEvent(
        Long requestId,
        String requestType,
        double lat,
        double lng,
        long budgetKrw
) {}
