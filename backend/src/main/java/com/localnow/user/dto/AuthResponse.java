package com.localnow.user.dto;

public record AuthResponse(
        String accessToken,
        Long userId,
        String role,
        String name
) {}
