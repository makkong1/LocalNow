package com.localnow.config.websocket;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.localnow.chat.domain.ChatRoom;
import com.localnow.chat.repository.ChatRoomRepository;
import com.localnow.config.security.JwtProvider;
import com.localnow.match.repository.MatchOfferRepository;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.repository.HelpRequestRepository;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class ChatChannelInterceptor implements ChannelInterceptor {

    private static final Pattern ROOM_TOPIC_PATTERN = Pattern.compile("^/topic/rooms/(\\d+)$");
    private static final Pattern USER_TOPIC_PATTERN = Pattern.compile("^/topic/users/(\\d+)$");
    private static final Pattern GUIDE_TOPIC_PATTERN = Pattern.compile("^/topic/guides/(\\d+)$");
    private static final Pattern REQUEST_TOPIC_PATTERN = Pattern.compile("^/topic/requests/(\\d+)$");

    private final JwtProvider jwtProvider;
    private final ChatRoomRepository chatRoomRepository;
    private final HelpRequestRepository helpRequestRepository;
    private final MatchOfferRepository matchOfferRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            authenticateOnConnect(message, accessor);
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            authorizeSubscribe(message, accessor);
        }

        return message;
    }

    private void authenticateOnConnect(Message<?> message, StompHeaderAccessor accessor) {
        String token = resolveToken(accessor);
        if (!StringUtils.hasText(token)) {
            return;
        }

        try {
            Claims claims = jwtProvider.validateToken(token);
            Long userId = Long.valueOf(claims.getSubject());
            String role = claims.get("role", String.class);
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
            accessor.setUser(auth);
        } catch (JwtException | IllegalArgumentException e) {
            throw new MessageDeliveryException(message, "Invalid JWT token");
        }
    }

    private void authorizeSubscribe(Message<?> message, StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null) {
            return;
        }

        Long userId = resolveUserId(accessor);
        if (userId == null) {
            throw new MessageDeliveryException(message, "Not authenticated");
        }

        // 토픽 패턴을 순서대로 검사하고, 매칭된 토픽에 대한 인가만 수행한다.
        if (authorizeUserTopicSubscription(message, destination, userId)) {
            return;
        }
        if (authorizeGuideTopicSubscription(message, accessor, destination, userId)) {
            return;
        }
        if (authorizeRequestTopicSubscription(message, accessor, destination, userId)) {
            return;
        }
        if (authorizeRoomTopicSubscription(message, destination, userId)) {
            return;
        }

        if (destination.startsWith("/topic/")) {
            throw new MessageDeliveryException(message, "Unknown topic destination");
        }
    }

    private boolean authorizeUserTopicSubscription(Message<?> message, String destination, Long userId) {
        Matcher userTopic = USER_TOPIC_PATTERN.matcher(destination);
        if (!userTopic.matches()) {
            return false;
        }

        long topicUserId = Long.parseLong(userTopic.group(1));
        if (userId != topicUserId) {
            throw new MessageDeliveryException(message, "Not allowed to subscribe to this user topic");
        }
        return true;
    }

    private boolean authorizeGuideTopicSubscription(
            Message<?> message, StompHeaderAccessor accessor, String destination, Long userId) {
        Matcher guideTopic = GUIDE_TOPIC_PATTERN.matcher(destination);
        if (!guideTopic.matches()) {
            return false;
        }

        long guideId = Long.parseLong(guideTopic.group(1));
        if (userId != guideId || !hasRole(accessor, "GUIDE")) {
            throw new MessageDeliveryException(message, "Not allowed to subscribe to this guide topic");
        }
        return true;
    }

    private boolean authorizeRequestTopicSubscription(
            Message<?> message, StompHeaderAccessor accessor, String destination, Long userId) {
        Matcher requestTopic = REQUEST_TOPIC_PATTERN.matcher(destination);
        if (!requestTopic.matches()) {
            return false;
        }

        long requestId = Long.parseLong(requestTopic.group(1));
        HelpRequest request = helpRequestRepository.findById(requestId)
                .orElseThrow(() -> new MessageDeliveryException(message, "Request not found"));

        if (userId.equals(request.getTravelerId())) {
            return true;
        }
        if (!hasRole(accessor, "GUIDE")) {
            throw new MessageDeliveryException(message, "Not allowed to subscribe to this request topic");
        }

        // OPEN 상태는 제안 전 단계라 모든 인증된 가이드에게 실시간 알림을 허용한다.
        if (request.getStatus() == HelpRequestStatus.OPEN) {
            return true;
        }
        if (!matchOfferRepository.existsByRequestIdAndGuideId(requestId, userId)) {
            throw new MessageDeliveryException(message, "Not allowed to subscribe to this request topic");
        }
        return true;
    }

    private boolean authorizeRoomTopicSubscription(Message<?> message, String destination, Long userId) {
        Matcher roomTopic = ROOM_TOPIC_PATTERN.matcher(destination);
        if (!roomTopic.matches()) {
            return false;
        }

        Long roomId = Long.valueOf(roomTopic.group(1));
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new MessageDeliveryException(message, "Room not found"));
        if (!room.isParticipant(userId)) {
            throw new MessageDeliveryException(message, "Not a participant of this room");
        }
        return true;
    }

    private String resolveToken(StompHeaderAccessor accessor) {
        String bearer = accessor.getFirstNativeHeader("Authorization");
        if (bearer == null) {
            return null;
        }
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }

    private Long resolveUserId(StompHeaderAccessor accessor) {
        if (accessor.getUser() instanceof UsernamePasswordAuthenticationToken auth) {
            return (Long) auth.getPrincipal();
        }
        return null;
    }

    private boolean hasRole(StompHeaderAccessor accessor, String role) {
        if (accessor.getUser() instanceof UsernamePasswordAuthenticationToken auth) {
            return auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_" + role));
        }
        return false;
    }
}
