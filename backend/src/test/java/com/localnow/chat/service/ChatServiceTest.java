package com.localnow.chat.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.chat.domain.ChatMessage;
import com.localnow.chat.domain.ChatRoom;
import com.localnow.chat.dto.ChatMessageRequest;
import com.localnow.chat.dto.ChatMessageResponse;
import com.localnow.chat.dto.ChatRoomSummaryResponse;
import com.localnow.chat.repository.ChatMessageRepository;
import com.localnow.chat.repository.ChatRoomRepository;
import com.localnow.infra.rabbit.RabbitPublisher;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.RequestType;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.user.domain.User;
import com.localnow.user.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock
    ChatRoomRepository chatRoomRepository;
    @Mock
    ChatMessageRepository chatMessageRepository;
    @Mock
    SimpMessagingTemplate messagingTemplate;
    @Mock
    RabbitPublisher rabbitPublisher;
    @Mock
    HelpRequestRepository helpRequestRepository;
    @Mock
    UserRepository userRepository;

    private ChatService chatService;

    @BeforeEach
    void setUp() {
        chatService = new ChatService(
                chatRoomRepository, chatMessageRepository, messagingTemplate, rabbitPublisher,
                helpRequestRepository, userRepository);
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

    @Test
    void getRoomsForUser_returns_partner_name_for_traveler() {
        Long travelerId = 10L;
        Long guideId = 20L;
        ChatRoom room = buildRoom(1L, travelerId, guideId);
        room.setRequestId(100L);

        when(chatRoomRepository.findByTravelerIdOrGuideIdOrderByIdDesc(travelerId, travelerId))
                .thenReturn(List.of(room));
        when(helpRequestRepository.findById(100L)).thenReturn(Optional.of(buildRequest(100L, RequestType.GUIDE)));
        User guide = buildUser(guideId, "Guide Kim");
        when(userRepository.findById(guideId)).thenReturn(Optional.of(guide));
        when(chatMessageRepository.findTopByRoomIdOrderBySentAtDesc(1L))
                .thenReturn(Optional.of(buildMessage(1L, 1L, guideId, "Hello", "uuid-1")));

        List<ChatRoomSummaryResponse> result = chatService.getRoomsForUser(travelerId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).partnerName()).isEqualTo("Guide Kim");
        assertThat(result.get(0).requestType()).isEqualTo("GUIDE");
        assertThat(result.get(0).lastMessagePreview()).isEqualTo("Hello");
    }

    @Test
    void getRoomsForUser_returns_partner_name_for_guide() {
        Long travelerId = 10L;
        Long guideId = 20L;
        ChatRoom room = buildRoom(1L, travelerId, guideId);
        room.setRequestId(100L);

        when(chatRoomRepository.findByTravelerIdOrGuideIdOrderByIdDesc(guideId, guideId))
                .thenReturn(List.of(room));
        when(helpRequestRepository.findById(100L)).thenReturn(Optional.of(buildRequest(100L, RequestType.TRANSLATION)));
        User traveler = buildUser(travelerId, "Traveler Lee");
        when(userRepository.findById(travelerId)).thenReturn(Optional.of(traveler));
        when(chatMessageRepository.findTopByRoomIdOrderBySentAtDesc(1L))
                .thenReturn(Optional.of(buildMessage(2L, 1L, travelerId, "Hi", "uuid-2")));

        List<ChatRoomSummaryResponse> result = chatService.getRoomsForUser(guideId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).partnerName()).isEqualTo("Traveler Lee");
        assertThat(result.get(0).requestType()).isEqualTo("TRANSLATION");
        assertThat(result.get(0).lastMessagePreview()).isEqualTo("Hi");
    }

    @Test
    void getRoomsForUser_returns_null_last_message_when_no_messages() {
        Long travelerId = 10L;
        Long guideId = 20L;
        ChatRoom room = buildRoom(1L, travelerId, guideId);
        room.setRequestId(100L);

        when(chatRoomRepository.findByTravelerIdOrGuideIdOrderByIdDesc(travelerId, travelerId))
                .thenReturn(List.of(room));
        when(helpRequestRepository.findById(100L)).thenReturn(Optional.of(buildRequest(100L, RequestType.FOOD)));
        User guide = buildUser(guideId, "Guide Park");
        when(userRepository.findById(guideId)).thenReturn(Optional.of(guide));
        when(chatMessageRepository.findTopByRoomIdOrderBySentAtDesc(1L)).thenReturn(Optional.empty());

        List<ChatRoomSummaryResponse> result = chatService.getRoomsForUser(travelerId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).lastMessagePreview()).isNull();
        assertThat(result.get(0).lastMessageAt()).isNull();
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

    private HelpRequest buildRequest(Long id, RequestType type) {
        HelpRequest req = new HelpRequest();
        req.setId(id);
        req.setRequestType(type);
        req.setTravelerId(10L);
        req.setLat(37.5);
        req.setLng(127.0);
        req.setStartAt(LocalDateTime.now());
        req.setDurationMin(60);
        req.setBudgetKrw(30000L);
        return req;
    }

    private User buildUser(Long id, String name) {
        User user = new User();
        user.setId(id);
        user.setName(name);
        user.setEmail("user" + id + "@test.com");
        return user;
    }
}
