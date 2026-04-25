CREATE TABLE payment_intents (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    request_id       BIGINT       NOT NULL UNIQUE,
    payer_id         BIGINT       NOT NULL,
    payee_id         BIGINT       NOT NULL,
    amount_krw       BIGINT       NOT NULL,
    platform_fee_krw BIGINT       NOT NULL,
    guide_payout_krw BIGINT       NOT NULL,
    status           ENUM('AUTHORIZED','CAPTURED','REFUNDED','FAILED') NOT NULL DEFAULT 'AUTHORIZED',
    authorization_id VARCHAR(100),
    capture_id       VARCHAR(100),
    idempotency_key  VARCHAR(100) NOT NULL UNIQUE,
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    FOREIGN KEY (request_id) REFERENCES help_requests(id),
    FOREIGN KEY (payer_id)   REFERENCES users(id),
    FOREIGN KEY (payee_id)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
