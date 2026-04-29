package com.localnow.user.dto;

import java.time.LocalDateTime;

public record CertificationResponse(
        Long id,
        String name,
        String fileUrl,
        LocalDateTime uploadedAt
) {}
