-- Extend user role (ADMIN for local/ops read-only dashboard; see ADR-014)
ALTER TABLE users
    MODIFY COLUMN role ENUM ('TRAVELER', 'GUIDE', 'ADMIN') NOT NULL;

-- Dev-only admin (password: localnow-admin-2026). Rotate hash in real deployments; do not expose via public signup.
INSERT INTO users (email, password, name, role, created_at, updated_at)
VALUES (
           'admin@localnow.test',
           '$2y$10$5fsN5qhfLbks3xaCEZfaWeDsxvl1XppgRY.CHBGboO68aHk.VA9aK',
           'LocalNow Admin',
           'ADMIN',
           CURRENT_TIMESTAMP(6),
           CURRENT_TIMESTAMP(6)
       );
