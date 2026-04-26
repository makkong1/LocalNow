package com.localnow.user.dto;

import com.localnow.user.domain.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

// 실제 이메일 인증(링크/코드) + 활성화 플래그는 이후 도입. 현재는 형식·중복만 검사한다.
public record SignupRequest(
        @NotBlank(message = "이메일을 입력하세요.")
        @Email(message = "올바른 이메일 형식이 아닙니다.")
        String email,
        @NotBlank(message = "비밀번호를 입력하세요.")
        @Size(min = 4, message = "비밀번호는 4자 이상이어야 합니다.")
        String password,
        @NotBlank(message = "이름을 입력하세요.")
        String name,
        @NotNull(message = "역할을 선택하세요.")
        UserRole role,
        List<String> languages,
        String city
) {}
