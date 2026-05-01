package com.localnow.notification.listener;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class MatchNotificationListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @SuppressWarnings("unused")
    @RabbitListener(queues = "match.notification")
    void handleMatchEvent(Message message) {
        String routingKey = message.getMessageProperties().getReceivedRoutingKey();
        try {
            String body = new String(message.getBody(), StandardCharsets.UTF_8);
            Map<String, Object> payload = objectMapper.readValue(body, new TypeReference<>() {
            });

            switch (routingKey) {
                case "match.offer.created" -> handleOfferCreated(payload);
                case "match.offer.accepted" -> handleOfferAccepted(payload);
                case "match.confirmed" -> handleMatchConfirmed(payload);
                default -> log.debug("reason=UNHANDLED_MATCH_ROUTING_KEY ko=처리되지 않은 매칭 라우팅 키 routingKey={}", routingKey);
            }
        } catch (JsonProcessingException | RuntimeException e) {
            log.error("reason=MATCH_EVENT_PROCESSING_FAILED ko=매칭 이벤트 처리 실패 routingKey={}", routingKey, e);
        }
    }

    private void handleOfferCreated(Map<String, Object> payload) {
        long requestId = toLong(payload.get("requestId"));
        String requestType = (String) payload.get("requestType");
        long budgetKrw = toLong(payload.get("budgetKrw"));

        @SuppressWarnings("unchecked")
        List<Number> guideIds = (List<Number>) payload.get("guideIds");
        if (guideIds == null)
            return;

        Map<String, Object> push = Map.of(
                "type", "NEW_REQUEST",
                "requestId", requestId,
                "requestType", requestType,
                "budgetKrw", budgetKrw);

        for (Number guideIdNum : guideIds) {
            long guideId = guideIdNum.longValue();
            try {
                messagingTemplate.convertAndSend("/topic/guides/" + guideId, push);
            } catch (RuntimeException e) {
                log.warn("reason=GUIDE_PUSH_FAILED ko=가이드에게 요청 알림 전송 실패 guideId={}", guideId, e);
            }
        }
    }

    private void handleOfferAccepted(Map<String, Object> payload) {
        long requestId = toLong(payload.get("requestId"));
        long guideId = toLong(payload.get("guideId"));

        try {
            messagingTemplate.convertAndSend("/topic/requests/" + requestId,
                    Map.of("type", "OFFER_ACCEPTED", "guideId", guideId));
        } catch (RuntimeException e) {
            log.warn("reason=REQUEST_PUSH_OFFER_ACCEPTED_FAILED ko=오퍼 수락 알림 전송 실패 requestId={}", requestId, e);
        }
    }

    private void handleMatchConfirmed(Map<String, Object> payload) {
        long requestId = toLong(payload.get("requestId"));
        long confirmedGuideId = toLong(payload.get("confirmedGuideId"));

        try {
            messagingTemplate.convertAndSend("/topic/guides/" + confirmedGuideId,
                    Map.of("type", "MATCH_CONFIRMED", "requestId", requestId));
        } catch (RuntimeException e) {
            log.warn("reason=GUIDE_PUSH_MATCH_CONFIRMED_FAILED ko=매칭 확정 알림 전송 실패 confirmedGuideId={}", confirmedGuideId, e);
        }
    }

    private long toLong(Object value) {
        if (value instanceof Number n)
            return n.longValue();
        throw new IllegalArgumentException("Expected Number but got: " + value);
    }
}
