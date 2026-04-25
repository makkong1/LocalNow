CREATE TABLE chat_rooms (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    request_id  BIGINT NOT NULL UNIQUE,
    traveler_id BIGINT NOT NULL,
    guide_id    BIGINT NOT NULL,
    created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    FOREIGN KEY (request_id)  REFERENCES help_requests(id),
    FOREIGN KEY (traveler_id) REFERENCES users(id),
    FOREIGN KEY (guide_id)    REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_messages (
    id                BIGINT      NOT NULL AUTO_INCREMENT,
    room_id           BIGINT      NOT NULL,
    sender_id         BIGINT      NOT NULL,
    content           TEXT        NOT NULL,
    client_message_id VARCHAR(36) NOT NULL,
    sent_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_chat_message_idempotent (room_id, sender_id, client_message_id),
    FOREIGN KEY (room_id)   REFERENCES chat_rooms(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, sent_at);
