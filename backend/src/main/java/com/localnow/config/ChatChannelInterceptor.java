package com.localnow.config;

import com.localnow.chat.domain.ChatRoom;
import com.localnow.chat.repository.ChatRoomRepository;
import com.localnow.match.repository.MatchOfferRepository;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.repository.HelpRequestRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
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

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class ChatChannelInterceptor implements ChannelInterceptor {

    private static final Pattern ROOM_TOPIC_PATTERN = Pattern.compile("^/topic/rooms/(\\d+)$");
    private static final Pattern USER_TOPIC_PATTERN = Pattern.compile("^/topic/users/(\\d+)$");
    private static final Pattern GUIDE_TOPIC_PATTERN = Pattern.compile("^/topic/guides/(\\d+)$");
    private static final Pattern REQUEST_TOPIC_PATTERN = Pattern.compile("^/topic/requests/(\\d+)$");

    private final JwtProvider jwtProvider;
    private final ChatRoomRepository chatRoomRepository;
    private final HelpRequestRepository helpRequestRepository;
    private final MatchOfferRepository matchOfferRepository;

    public ChatChannelInterceptor(
            JwtProvider jwtProvider,
            ChatRoomRepository chatRoomRepository,
            HelpRequestRepository helpRequestRepository,
            MatchOfferRepository matchOfferRepository) {
        this.jwtProvider = jwtProvider;
        this.chatRoomRepository = chatRoomRepository;
        this.helpRequestRepository = helpRequestRepository;
        this.matchOfferRepository = matchOfferRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = resolveToken(accessor);
            if (StringUtils.hasText(token)) {
                try {
                    Claims claims = jwtProvider.validateToken(token);
                    Long userId = Long.parseLong(claims.getSubject());
                    String role = claims.get("role", String.class);
                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                            userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
                    accessor.setUser(auth);
                } catch (JwtException | IllegalArgumentException e) {
                    throw new MessageDeliveryException(message, "Invalid JWT token");
                }
            }
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();
            if (destination != null) {
                Long userId = resolveUserId(accessor);
                if (userId == null) {
                    throw new MessageDeliveryException(message, "Not authenticated");
                }

                Matcher userTopic = USER_TOPIC_PATTERN.matcher(destination);
                if (userTopic.matches()) {
                    long topicUserId = Long.parseLong(userTopic.group(1));
                    if (userId != topicUserId) {
                        throw new MessageDeliveryException(message, "Not allowed to subscribe to this user topic");
                    }
                } else {
                    Matcher guideTopic = GUIDE_TOPIC_PATTERN.matcher(destination);
                    if (guideTopic.matches()) {
                        long guideId = Long.parseLong(guideTopic.group(1));
                        if (userId != guideId || !hasRole(accessor, "GUIDE")) {
                            throw new MessageDeliveryException(message, "Not allowed to subscribe to this guide topic");
                        }
                    } else {
                        Matcher requestTopic = REQUEST_TOPIC_PATTERN.matcher(destination);
                        if (requestTopic.matches()) {
                            long requestId = Long.parseLong(requestTopic.group(1));
                            HelpRequest request = helpRequestRepository.findById(requestId)
                                    .orElseThrow(() -> new MessageDeliveryException(message, "Request not found"));
                            if (userId.equals(request.getTravelerId())) {
                                // allowed
                            } else if (hasRole(accessor, "GUIDE")) {
                                if (request.getStatus() == HelpRequestStatus.OPEN) {
                                    // any authenticated guide can watch OPEN request notifications
                                } else if (!matchOfferRepository.existsByRequestIdAndGuideId(requestId, userId)) {
                                    throw new MessageDeliveryException(message, "Not allowed to subscribe to this request topic");
                                }
                            } else {
                                throw new MessageDeliveryException(message, "Not allowed to subscribe to this request topic");
                            }
                        } else {
                            Matcher roomTopic = ROOM_TOPIC_PATTERN.matcher(destination);
                            if (roomTopic.matches()) {
                                Long roomId = Long.parseLong(roomTopic.group(1));
                                ChatRoom room = chatRoomRepository.findById(roomId)
                                        .orElseThrow(() -> new MessageDeliveryException(message, "Room not found"));
                                if (!room.isParticipant(userId)) {
                                    throw new MessageDeliveryException(message, "Not a participant of this room");
                                }
                            } else if (destination.startsWith("/topic/")) {
                                throw new MessageDeliveryException(message, "Unknown topic destination");
                            }
                        }
                    }
                }
            }
        }

        return message;
    }

    private String resolveToken(StompHeaderAccessor accessor) {
        String bearer = accessor.getFirstNativeHeader("Authorization");
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
