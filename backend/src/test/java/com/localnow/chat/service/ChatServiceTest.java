package com.localnow.chat.service;

import com.localnow.chat.domain.ChatMessage;
import com.localnow.chat.domain.ChatRoom;
import com.localnow.chat.dto.ChatMessageRequest;
import com.localnow.chat.dto.ChatMessageResponse;
import com.localnow.chat.repository.ChatMessageRepository;
import com.localnow.chat.repository.ChatRoomRepository;
import com.localnow.infra.rabbit.RabbitPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock ChatRoomRepository chatRoomRepository;
    @Mock ChatMessageRepository chatMessageRepository;
    @Mock SimpMessagingTemplate messagingTemplate;
    @Mock RabbitPublisher rabbitPublisher;

    private ChatService chatService;

    @BeforeEach
    void setUp() {
        chatService = new ChatService(
                chatRoomRepository, chatMessageRepository, messagingTemplate, rabbitPublisher);
    }

    @Test
    void sendMessage_returns_existing_message_when_client_message_id_is_duplicate() {
        ChatRoom room = buildRoom(1L, 10L, 20L);
        when(chatRoomRepository.findById(1L)).thenReturn(Optional.of(room));

        ChatMessage existing = buildMessage(99L, 1L, 10L, "Hello", "uuid-123");
        when(chatMessageRepository.findByRoomIdAndSenderIdAndClientMessageId(1L, 10L, "uuid-123"))
                .thenReturn(Optional.of(existing));

        ChatMessageResponse response = chatService.sendMessage(1L, 10L,
                new ChatMessageRequest("Hello", "uuid-123"));

        assertThat(response.messageId()).isEqualTo(99L);
        assertThat(response.clientMessageId()).isEqualTo("uuid-123");
        verify(chatMessageRepository, never()).save(any());
        verify(messagingTemplate, never()).convertAndSend(any(String.class), (Object) any());
    }

    @Test
    void getHistory_throws_AUTH_FORBIDDEN_when_requester_is_not_participant() {
        ChatRoom room = buildRoom(1L, 10L, 20L);
        when(chatRoomRepository.findById(1L)).thenReturn(Optional.of(room));

        assertThatThrownBy(() -> chatService.getHistory(1L, 99L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }

    private ChatRoom buildRoom(Long id, Long travelerId, Long guideId) {
        ChatRoom room = new ChatRoom();
        room.setId(id);
        room.setRequestId(1L);
        room.setTravelerId(travelerId);
        room.setGuideId(guideId);
        return room;
    }

    private ChatMessage buildMessage(Long id, Long roomId, Long senderId, String content, String clientId) {
        ChatMessage msg = new ChatMessage();
        msg.setId(id);
        msg.setRoomId(roomId);
        msg.setSenderId(senderId);
        msg.setContent(content);
        msg.setClientMessageId(clientId);
        return msg;
    }
}
