package com.localnow.config;

import com.localnow.chat.domain.ChatRoom;
import com.localnow.chat.repository.ChatRoomRepository;
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

    private final JwtProvider jwtProvider;
    private final ChatRoomRepository chatRoomRepository;

    public ChatChannelInterceptor(JwtProvider jwtProvider, ChatRoomRepository chatRoomRepository) {
        this.jwtProvider = jwtProvider;
        this.chatRoomRepository = chatRoomRepository;
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
                Matcher matcher = ROOM_TOPIC_PATTERN.matcher(destination);
                if (matcher.matches()) {
                    Long roomId = Long.parseLong(matcher.group(1));
                    Long userId = resolveUserId(accessor);
                    if (userId == null) {
                        throw new MessageDeliveryException(message, "Not authenticated");
                    }
                    ChatRoom room = chatRoomRepository.findById(roomId)
                            .orElseThrow(() -> new MessageDeliveryException(message, "Room not found"));
                    if (!room.isParticipant(userId)) {
                        throw new MessageDeliveryException(message, "Not a participant of this room");
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
}
