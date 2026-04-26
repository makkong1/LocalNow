package com.localnow.chat.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.localnow.chat.domain.ChatMessage;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByRoomIdOrderBySentAtAsc(Long roomId);

    Optional<ChatMessage> findByRoomIdAndSenderIdAndClientMessageId(
            Long roomId, Long senderId, String clientMessageId);
}
