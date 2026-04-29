package com.localnow.common;

public enum ErrorCode {
    AUTH_UNAUTHENTICATED(401, "로그인이 필요합니다."),
    AUTH_FORBIDDEN(403, "접근 권한이 없습니다."),
    VALIDATION_FAILED(422, "입력 값을 확인해 주세요."),
    USER_NOT_FOUND(404, "사용자를 찾을 수 없습니다."),
    REQUEST_NOT_FOUND(404, "도움 요청을 찾을 수 없습니다."),
    REQUEST_NOT_OPEN(409, "OPEN 상태가 아닌 요청입니다."),
    MATCH_ALREADY_CONFIRMED(409, "이미 다른 가이드가 확정되었습니다."),
    PAYMENT_INVALID_STATE(409, "결제 상태가 올바르지 않습니다."),
    RATE_LIMITED(429, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."),
    NOT_FOUND(404, "리소스를 찾을 수 없습니다."),
    OPTIMISTIC_LOCK_CONFLICT(409, "다른 요청에서 먼저 수정했습니다. 새로고침 후 다시 시도해 주세요."),
    INTERNAL_ERROR(500, "서버 오류가 발생했습니다.");

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
