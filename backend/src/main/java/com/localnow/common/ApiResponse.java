package com.localnow.common;

import java.util.List;

import org.slf4j.MDC;

public record ApiResponse<T>(
        boolean success,
        T data,
        ErrorBody error,
        Meta meta) {
    public record ErrorBody(String code, String message, List<FieldError> fields) {
    }

    public record FieldError(String field, String message) {
    }

    public record Meta(String requestId) {
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, new Meta(MDC.get("requestId")));
    }

    public static <T> ApiResponse<T> fail(ErrorCode code, String message) {
        return new ApiResponse<>(false, null,
                new ErrorBody(code.name(), message, null),
                new Meta(MDC.get("requestId")));
    }

    public static <T> ApiResponse<T> fail(ErrorCode code, String message, List<FieldError> fields) {
        return new ApiResponse<>(false, null,
                new ErrorBody(code.name(), message, fields),
                new Meta(MDC.get("requestId")));
    }
}
