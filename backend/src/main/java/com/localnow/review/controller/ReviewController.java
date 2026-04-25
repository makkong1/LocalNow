package com.localnow.review.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.localnow.common.ApiResponse;
import com.localnow.review.dto.CreateReviewRequest;
import com.localnow.review.dto.ReviewPageResponse;
import com.localnow.review.dto.ReviewResponse;
import com.localnow.review.service.ReviewService;

import jakarta.validation.Valid;

@RestController
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping("/requests/{requestId}/review")
    public ResponseEntity<ApiResponse<ReviewResponse>> createReview(
            @PathVariable @NonNull Long requestId,
            @Valid @RequestBody @NonNull CreateReviewRequest body,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(reviewService.createReview(userId, requestId, body)));
    }

    @GetMapping("/users/{userId}/reviews")
    public ResponseEntity<ApiResponse<ReviewPageResponse>> getReviews(
            @PathVariable @NonNull Long userId,
            @RequestParam(required = false) @Nullable Long cursor,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.ok(reviewService.getReviews(userId, cursor, size)));
    }
}
