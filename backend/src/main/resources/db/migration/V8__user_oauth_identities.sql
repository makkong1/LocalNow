CREATE TABLE user_oauth_identities (
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    user_id            BIGINT      NOT NULL,
    provider           VARCHAR(32) NOT NULL,
    provider_user_id   VARCHAR(255) NOT NULL,
    created_at         DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at         DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_provider_sub (provider, provider_user_id),
    KEY idx_oauth_user (user_id),
    CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 비밀번호 가입 + OAuth(구글) 연동: OAuth 전용 계정은 password NULL
ALTER TABLE users
    MODIFY password VARCHAR(255) NULL;
