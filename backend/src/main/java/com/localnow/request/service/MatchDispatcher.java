package com.localnow.request.service;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.localnow.infra.rabbit.RabbitPublisher;
import com.localnow.infra.redis.RedisGeoService;
import com.localnow.request.event.MatchDispatchEvent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class MatchDispatcher {

    private final RedisGeoService redisGeoService;
    private final RabbitPublisher rabbitPublisher;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMatchDispatch(MatchDispatchEvent event) {
        List<Long> guideIds = redisGeoService.searchNearby(event.lat(), event.lng(), 5.0);
        if (guideIds.isEmpty()) {
            return;
        }
        Map<String, Object> payload = Map.of(
                "requestId", event.requestId(),
                "requestType", event.requestType(),
                "lat", event.lat(),
                "lng", event.lng(),
                "budgetKrw", event.budgetKrw(),
                "guideIds", guideIds);
        rabbitPublisher.publish("match.offer.created", payload);
    }
}
