package com.localnow.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record EmailHintVerifyRequest(
        @NotBlank(message = "티켓이 필요합니다.") String ticketId,
        @NotBlank(message = "인증번호를 입력하세요.") @Pattern(regexp = "^\\d{6}$", message = "인증번호는 6자리 숫자입니다.") String code) {}
