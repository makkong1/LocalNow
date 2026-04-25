package com.localnow.notification.listener;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Component
public class MatchNotificationListener {

    private static final Logger log = LoggerFactory.getLogger(MatchNotificationListener.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    public MatchNotificationListener(SimpMessagingTemplate messagingTemplate, ObjectMapper objectMapper) {
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
    }

    @RabbitListener(queues = "match.notification")
    void handleMatchEvent(Message message) {
        String routingKey = message.getMessageProperties().getReceivedRoutingKey();
        try {
            String body = new String(message.getBody(), StandardCharsets.UTF_8);
            Map<String, Object> payload = objectMapper.readValue(body, new TypeReference<>() {});

            switch (routingKey) {
                case "match.offer.created" -> handleOfferCreated(payload);
                case "match.offer.accepted" -> handleOfferAccepted(payload);
                case "match.confirmed" -> handleMatchConfirmed(payload);
                default -> log.debug("Unhandled match routing key: {}", routingKey);
            }
        } catch (Exception e) {
            log.error("Failed to process match event: routingKey={}", routingKey, e);
        }
    }

    private void handleOfferCreated(Map<String, Object> payload) {
        long requestId = toLong(payload.get("requestId"));
        String requestType = (String) payload.get("requestType");
        long budgetKrw = toLong(payload.get("budgetKrw"));

        @SuppressWarnings("unchecked")
        List<Number> guideIds = (List<Number>) payload.get("guideIds");
        if (guideIds == null) return;

        Map<String, Object> push = Map.of(
                "type", "NEW_REQUEST",
                "requestId", requestId,
                "requestType", requestType,
                "budgetKrw", budgetKrw
        );

        for (Number guideIdNum : guideIds) {
            long guideId = guideIdNum.longValue();
            try {
                messagingTemplate.convertAndSend("/topic/guides/" + guideId, push);
            } catch (Exception e) {
                log.warn("Failed to push to guide {}", guideId, e);
            }
        }
    }

    private void handleOfferAccepted(Map<String, Object> payload) {
        long requestId = toLong(payload.get("requestId"));
        long guideId = toLong(payload.get("guideId"));

        try {
            messagingTemplate.convertAndSend("/topic/requests/" + requestId,
                    Map.of("type", "OFFER_ACCEPTED", "guideId", guideId));
        } catch (Exception e) {
            log.warn("Failed to push offer accepted for request {}", requestId, e);
        }
    }

    private void handleMatchConfirmed(Map<String, Object> payload) {
        long requestId = toLong(payload.get("requestId"));
        long confirmedGuideId = toLong(payload.get("confirmedGuideId"));

        try {
            messagingTemplate.convertAndSend("/topic/guides/" + confirmedGuideId,
                    Map.of("type", "MATCH_CONFIRMED", "requestId", requestId));
        } catch (Exception e) {
            log.warn("Failed to push match confirmed to guide {}", confirmedGuideId, e);
        }
    }

    private long toLong(Object value) {
        if (value instanceof Number n) return n.longValue();
        throw new IllegalArgumentException("Expected Number but got: " + value);
    }
}
