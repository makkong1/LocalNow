package com.localnow.user.dto;

import java.math.BigDecimal;
import java.util.List;

public record UserProfileResponse(
        Long id,
        String email,
        String name,
        String role,
        List<String> languages,
        String city,
        BigDecimal avgRating,
        Integer ratingCount,
        String profileImageUrl,
        Short birthYear,
        String bio
) {}
