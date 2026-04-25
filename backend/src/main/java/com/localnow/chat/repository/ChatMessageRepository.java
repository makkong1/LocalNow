package com.localnow.chat.repository;

import com.localnow.chat.domain.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByRoomIdOrderBySentAtAsc(Long roomId);
    Optional<ChatMessage> findByRoomIdAndSenderIdAndClientMessageId(
            Long roomId, Long senderId, String clientMessageId);
}
