ALTER TABLE users
    ADD COLUMN profile_image_url VARCHAR(500) NULL,
    ADD COLUMN birth_year SMALLINT NULL,
    ADD COLUMN bio TEXT NULL;

CREATE TABLE certifications (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    user_id     BIGINT NOT NULL,
    name        VARCHAR(200) NOT NULL,
    file_url    VARCHAR(500) NOT NULL,
    uploaded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_cert_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_cert_user ON certifications(user_id);
