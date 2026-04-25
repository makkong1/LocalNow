package com.localnow.request.service;

import com.localnow.infra.rabbit.RabbitPublisher;
import com.localnow.infra.redis.RedisGeoService;
import com.localnow.request.event.MatchDispatchEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;
import java.util.Map;

@Component
public class MatchDispatcher {

    private final RedisGeoService redisGeoService;
    private final RabbitPublisher rabbitPublisher;

    public MatchDispatcher(RedisGeoService redisGeoService, RabbitPublisher rabbitPublisher) {
        this.redisGeoService = redisGeoService;
        this.rabbitPublisher = rabbitPublisher;
    }

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
                "guideIds", guideIds
        );
        rabbitPublisher.publish("match.offer.created", payload);
    }
}
