package com.localnow.user.dto;

import com.localnow.review.dto.ReviewResponse;

import java.math.BigDecimal;
import java.util.List;

public record PublicProfileResponse(
        Long id,
        String name,
        String profileImageUrl,
        Integer birthYear,
        String bio,
        String role,
        List<String> languages,
        BigDecimal avgRating,
        Integer ratingCount,
        Integer completedCount,
        List<CertificationResponse> certifications,
        List<ReviewResponse> recentReviews
) {}
