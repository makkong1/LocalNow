package com.localnow.notification.listener;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
@RequiredArgsConstructor
public class ChatNotificationListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @RabbitListener(queues = "chat.notification")
    void handleChatEvent(Message message) {
        String routingKey = message.getMessageProperties().getReceivedRoutingKey();
        try {
            String body = new String(message.getBody(), StandardCharsets.UTF_8);
            Map<String, Object> payload = objectMapper.readValue(body, new TypeReference<>() {
            });

            if ("chat.message.sent".equals(routingKey)) {
                handleChatMessageSent(payload);
            }
        } catch (Exception e) {
            log.error("reason=CHAT_EVENT_PROCESSING_FAILED ko=채팅 이벤트 처리 실패 routingKey={}", routingKey, e);
        }
    }

    private void handleChatMessageSent(Map<String, Object> payload) {
        long roomId = toLong(payload.get("roomId"));
        long receiverId = toLong(payload.get("receiverId"));
        String content = (String) payload.get("content");

        String preview = content != null && content.length() > 30
                ? content.substring(0, 30)
                : content;

        try {
            messagingTemplate.convertAndSend("/topic/users/" + receiverId,
                    Map.of("type", "CHAT_MESSAGE", "roomId", roomId, "preview", preview != null ? preview : ""));
        } catch (Exception e) {
            log.warn("reason=CHAT_PUSH_FAILED ko=채팅 메시지 실시간 전송 실패 receiverId={}", receiverId, e);
        }
    }

    private long toLong(Object value) {
        if (value instanceof Number n)
            return n.longValue();
        throw new IllegalArgumentException("Expected Number but got: " + value);
    }
}
