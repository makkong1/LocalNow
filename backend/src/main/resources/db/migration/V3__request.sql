CREATE TABLE help_requests (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    traveler_id   BIGINT       NOT NULL,
    request_type  ENUM('GUIDE','TRANSLATION','FOOD','EMERGENCY') NOT NULL,
    lat           DOUBLE       NOT NULL,
    lng           DOUBLE       NOT NULL,
    description   TEXT,
    start_at      DATETIME(6)  NOT NULL,
    duration_min  INT          NOT NULL,
    budget_krw    BIGINT       NOT NULL,
    status        ENUM('OPEN','MATCHED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'OPEN',
    version       INT          NOT NULL DEFAULT 0,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    FOREIGN KEY (traveler_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_help_requests_traveler ON help_requests(traveler_id);
CREATE INDEX idx_help_requests_status   ON help_requests(status);
