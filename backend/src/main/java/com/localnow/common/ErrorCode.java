package com.localnow.common;

public enum ErrorCode {
    AUTH_UNAUTHENTICATED(401, "Unauthenticated"),
    AUTH_FORBIDDEN(403, "Forbidden"),
    VALIDATION_FAILED(422, "Validation failed"),
    REQUEST_NOT_FOUND(404, "Request not found"),
    REQUEST_NOT_OPEN(409, "Request is not open"),
    MATCH_ALREADY_CONFIRMED(409, "Match already confirmed"),
    PAYMENT_INVALID_STATE(409, "Payment invalid state"),
    RATE_LIMITED(429, "Rate limited"),
    INTERNAL_ERROR(500, "Internal server error");

    private final int httpStatus;
    private final String defaultMessage;

    ErrorCode(int httpStatus, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    public int getHttpStatus() {
        return httpStatus;
    }

    public String getDefaultMessage() {
        return defaultMessage;
    }
}
