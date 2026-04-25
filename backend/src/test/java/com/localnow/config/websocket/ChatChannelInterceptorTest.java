package com.localnow.config.websocket;

import com.localnow.chat.domain.ChatRoom;
import com.localnow.chat.repository.ChatRoomRepository;
import com.localnow.config.security.JwtProvider;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.domain.RequestType;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.match.repository.MatchOfferRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatChannelInterceptorTest {

    @Mock JwtProvider jwtProvider;
    @Mock ChatRoomRepository chatRoomRepository;
    @Mock HelpRequestRepository helpRequestRepository;
    @Mock MatchOfferRepository matchOfferRepository;

    private ChatChannelInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new ChatChannelInterceptor(
                jwtProvider, chatRoomRepository, helpRequestRepository, matchOfferRepository);
    }

    @Test
    void subscribe_rejects_wrong_user_topic() {
        Message<?> msg = subscribeMessage("/topic/users/2", userAuth(1L, "TRAVELER"));

        assertThatThrownBy(() -> interceptor.preSend(msg, null))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void subscribe_rejects_wrong_guide_topic() {
        Message<?> msg = subscribeMessage("/topic/guides/2", userAuth(1L, "GUIDE"));

        assertThatThrownBy(() -> interceptor.preSend(msg, null))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void subscribe_allows_request_topic_for_traveler_owner() {
        HelpRequest r = openRequest(5L, 10L);
        when(helpRequestRepository.findById(5L)).thenReturn(Optional.of(r));

        Message<?> msg = subscribeMessage("/topic/requests/5", userAuth(10L, "TRAVELER"));

        interceptor.preSend(msg, null);
    }

    @Test
    void subscribe_allows_request_topic_for_involved_guide() {
        HelpRequest r = matchedRequest(5L, 10L);
        when(helpRequestRepository.findById(5L)).thenReturn(Optional.of(r));
        when(matchOfferRepository.existsByRequestIdAndGuideId(5L, 20L)).thenReturn(true);

        Message<?> msg = subscribeMessage("/topic/requests/5", userAuth(20L, "GUIDE"));

        interceptor.preSend(msg, null);
    }

    @Test
    void subscribe_rejects_request_topic_for_unrelated_guide() {
        HelpRequest r = matchedRequest(5L, 10L);
        when(helpRequestRepository.findById(5L)).thenReturn(Optional.of(r));
        when(matchOfferRepository.existsByRequestIdAndGuideId(5L, 99L)).thenReturn(false);

        Message<?> msg = subscribeMessage("/topic/requests/5", userAuth(99L, "GUIDE"));

        assertThatThrownBy(() -> interceptor.preSend(msg, null))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void subscribe_rejects_room_topic_for_non_participant() {
        ChatRoom room = new ChatRoom();
        room.setId(3L);
        room.setRequestId(1L);
        room.setTravelerId(10L);
        room.setGuideId(20L);
        when(chatRoomRepository.findById(3L)).thenReturn(Optional.of(room));

        Message<?> msg = subscribeMessage("/topic/rooms/3", userAuth(99L, "GUIDE"));

        assertThatThrownBy(() -> interceptor.preSend(msg, null))
                .isInstanceOf(MessageDeliveryException.class);
    }

    private static UsernamePasswordAuthenticationToken userAuth(Long userId, String role) {
        return new UsernamePasswordAuthenticationToken(
                userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    private static Message<?> subscribeMessage(String destination,
                                               UsernamePasswordAuthenticationToken user) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination(destination);
        accessor.setUser(user);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private static HelpRequest openRequest(Long id, Long travelerId) {
        HelpRequest r = new HelpRequest();
        r.setId(id);
        r.setTravelerId(travelerId);
        r.setRequestType(RequestType.GUIDE);
        r.setLat(37.5);
        r.setLng(127.0);
        r.setStartAt(LocalDateTime.now().plusHours(1));
        r.setDurationMin(60);
        r.setBudgetKrw(10000L);
        r.setStatus(HelpRequestStatus.OPEN);
        return r;
    }

    private static HelpRequest matchedRequest(Long id, Long travelerId) {
        HelpRequest r = openRequest(id, travelerId);
        r.setStatus(HelpRequestStatus.MATCHED);
        return r;
    }
}
