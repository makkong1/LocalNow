package com.localnow.review.dto;

import java.util.List;

public record ReviewPageResponse(List<ReviewResponse> items, Long nextCursor) {}
