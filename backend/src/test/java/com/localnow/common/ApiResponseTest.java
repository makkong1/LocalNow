package com.localnow.common;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ApiResponseTest {

    @Test
    void ok_wraps_data_with_success_true() {
        ApiResponse<String> response = ApiResponse.ok("hello");

        assertThat(response.success()).isTrue();
        assertThat(response.data()).isEqualTo("hello");
        assertThat(response.error()).isNull();
    }

    @Test
    void fail_wraps_error_with_success_false() {
        ApiResponse<?> response = ApiResponse.fail(ErrorCode.INTERNAL_ERROR, "Something went wrong");

        assertThat(response.success()).isFalse();
        assertThat(response.data()).isNull();
        assertThat(response.error()).isNotNull();
        assertThat(response.error().code()).isEqualTo("INTERNAL_ERROR");
        assertThat(response.error().message()).isEqualTo("Something went wrong");
    }

    @Test
    void fail_includes_field_errors() {
        List<ApiResponse.FieldError> fields = List.of(
                new ApiResponse.FieldError("name", "must not be blank"));
        ApiResponse<?> response = ApiResponse.fail(ErrorCode.VALIDATION_FAILED, "Validation failed", fields);

        assertThat(response.error().fields()).hasSize(1);
        assertThat(response.error().fields().get(0).field()).isEqualTo("name");
        assertThat(response.error().fields().get(0).message()).isEqualTo("must not be blank");
    }

    @Test
    void ok_sets_null_error() {
        ApiResponse<Integer> response = ApiResponse.ok(42);

        assertThat(response.error()).isNull();
    }
}
