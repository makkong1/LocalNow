-- Composite indexes for cursor-based pagination (replaces single-column indexes where applicable)
-- Uses IF EXISTS / IF NOT EXISTS for idempotency (MySQL 8.0.29+)

-- help_requests: drop old single-column index, add composite (status, id)
ALTER TABLE help_requests DROP INDEX IF EXISTS idx_help_requests_status;
ALTER TABLE help_requests ADD INDEX IF NOT EXISTS idx_hr_status_id (status, id);

-- help_requests: drop old single-column index, add composite (traveler_id, id)
ALTER TABLE help_requests DROP INDEX IF EXISTS idx_help_requests_traveler;
ALTER TABLE help_requests ADD INDEX IF NOT EXISTS idx_hr_traveler_id (traveler_id, id);

-- reviews: add composite (reviewee_id, id)
ALTER TABLE reviews ADD INDEX IF NOT EXISTS idx_reviews_reviewee_id (reviewee_id, id);
