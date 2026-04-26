package com.localnow.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CreateReviewRequest(
                @NotNull(message = "평점을 선택하세요.")
                @Min(value = 1, message = "평점은 1~5 사이여야 합니다.")
                @Max(value = 5, message = "평점은 1~5 사이여야 합니다.")
                Integer rating,
                String comment) {
}
