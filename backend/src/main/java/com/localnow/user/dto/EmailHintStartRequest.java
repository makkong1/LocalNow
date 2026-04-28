package com.localnow.user.dto;

import jakarta.validation.constraints.NotBlank;

/** 아이디(이메일) 확인 — 가입 시 입력한 이름·도시로 계정을 특정한다. */
public record EmailHintStartRequest(
        @NotBlank(message = "이름을 입력하세요.") String name,
        @NotBlank(message = "도시를 입력하세요.") String city) {}
