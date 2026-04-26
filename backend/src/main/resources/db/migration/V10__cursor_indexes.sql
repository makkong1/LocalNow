-- Composite indexes for cursor-based pagination (replaces single-column indexes where applicable)

-- help_requests: status cursor pagination (GET /requests/open)
ALTER TABLE help_requests
    DROP INDEX idx_help_requests_status,
    ADD INDEX idx_hr_status_id (status, id);

-- help_requests: traveler cursor pagination (GET /requests/me)
ALTER TABLE help_requests
    DROP INDEX idx_help_requests_traveler,
    ADD INDEX idx_hr_traveler_id (traveler_id, id);

-- reviews: reviewee cursor pagination (GET /users/{userId}/reviews)
ALTER TABLE reviews
    ADD INDEX idx_reviews_reviewee_id (reviewee_id, id);
