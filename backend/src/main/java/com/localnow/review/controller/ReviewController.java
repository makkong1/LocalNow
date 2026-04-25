package com.localnow.review.controller;

import com.localnow.common.ApiResponse;
import com.localnow.review.dto.CreateReviewRequest;
import com.localnow.review.dto.ReviewPageResponse;
import com.localnow.review.dto.ReviewResponse;
import com.localnow.review.service.ReviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping("/requests/{requestId}/review")
    public ResponseEntity<ApiResponse<ReviewResponse>> createReview(
            @PathVariable Long requestId,
            @Valid @RequestBody CreateReviewRequest body,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(reviewService.createReview(userId, requestId, body)));
    }

    @GetMapping("/users/{userId}/reviews")
    public ResponseEntity<ApiResponse<ReviewPageResponse>> getReviews(
            @PathVariable Long userId,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.ok(reviewService.getReviews(userId, cursor, size)));
    }
}
