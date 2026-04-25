CREATE TABLE match_offers (
    id           BIGINT  NOT NULL AUTO_INCREMENT,
    request_id   BIGINT  NOT NULL,
    guide_id     BIGINT  NOT NULL,
    status       ENUM('PENDING','CONFIRMED','REJECTED') NOT NULL DEFAULT 'PENDING',
    message      TEXT,
    created_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_match_offer (request_id, guide_id),
    FOREIGN KEY (request_id) REFERENCES help_requests(id),
    FOREIGN KEY (guide_id)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_match_offers_request ON match_offers(request_id);
CREATE INDEX idx_match_offers_guide   ON match_offers(guide_id);
