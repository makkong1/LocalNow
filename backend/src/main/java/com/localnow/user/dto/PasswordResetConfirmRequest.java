package com.localnow.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PasswordResetConfirmRequest(
        @NotBlank(message = "티켓이 필요합니다.") String ticketId,
        @NotBlank(message = "인증번호를 입력하세요.") @Pattern(regexp = "^\\d{6}$", message = "인증번호는 6자리 숫자입니다.") String code,
        @NotBlank(message = "새 비밀번호를 입력하세요.") @Size(min = 4, message = "비밀번호는 4자 이상이어야 합니다.") String newPassword) {}
