package com.localnow.admin.dto;

/**
 * Read-only aggregations for the ops dashboard (ADR-014).
 */
public record AdminSummaryResponse(
        long userCount,
        long helpRequestsOpen,
        long helpRequestsMatched,
        long helpRequestsInProgress,
        long helpRequestsCompleted,
        long helpRequestsCancelled) {
}
