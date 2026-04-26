-- Composite indexes for cursor-based pagination.
-- Defensive: only DROP V3 single-column indexes if they exist; only ADD if missing
-- (local DBs may not match a fresh Flyway run 1:1).

SET @db = DATABASE();

-- help_requests: V3 had idx_help_requests_status -> (status, id)
SET @c = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @db AND table_name = 'help_requests' AND index_name = 'idx_help_requests_status');
SET @q = IF(@c > 0, 'ALTER TABLE help_requests DROP INDEX idx_help_requests_status', 'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @db AND table_name = 'help_requests' AND index_name = 'idx_hr_status_id');
SET @q = IF(@c = 0, 'ALTER TABLE help_requests ADD INDEX idx_hr_status_id (status, id)', 'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- help_requests: V3 had idx_help_requests_traveler -> (traveler_id, id)
SET @c = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @db AND table_name = 'help_requests' AND index_name = 'idx_help_requests_traveler');
SET @q = IF(@c > 0, 'ALTER TABLE help_requests DROP INDEX idx_help_requests_traveler', 'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @db AND table_name = 'help_requests' AND index_name = 'idx_hr_traveler_id');
SET @q = IF(@c = 0, 'ALTER TABLE help_requests ADD INDEX idx_hr_traveler_id (traveler_id, id)', 'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviews: list by reviewee + cursor
SET @c = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @db AND table_name = 'reviews' AND index_name = 'idx_reviews_reviewee_id');
SET @q = IF(@c = 0, 'ALTER TABLE reviews ADD INDEX idx_reviews_reviewee_id (reviewee_id, id)', 'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;
