CREATE TABLE reviews (
    id          BIGINT  NOT NULL AUTO_INCREMENT,
    request_id  BIGINT  NOT NULL UNIQUE,
    reviewer_id BIGINT  NOT NULL,
    reviewee_id BIGINT  NOT NULL,
    rating      TINYINT NOT NULL,
    comment     TEXT,
    created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    FOREIGN KEY (request_id)  REFERENCES help_requests(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    FOREIGN KEY (reviewee_id) REFERENCES users(id),
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
