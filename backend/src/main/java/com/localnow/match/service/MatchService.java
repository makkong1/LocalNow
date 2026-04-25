package com.localnow.match.service;

import com.localnow.chat.service.ChatService;
import com.localnow.common.ErrorCode;
import com.localnow.infra.rabbit.RabbitPublisher;
import com.localnow.match.domain.MatchOffer;
import com.localnow.match.domain.MatchOfferStatus;
import com.localnow.match.dto.AcceptRequest;
import com.localnow.match.dto.ConfirmRequest;
import com.localnow.match.dto.MatchOfferResponse;
import com.localnow.match.repository.MatchOfferRepository;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;
import com.localnow.user.repository.UserRepository;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class MatchService {

    private static final DefaultRedisScript<Long> RELEASE_LOCK_SCRIPT = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            Long.class
    );

    private final HelpRequestRepository helpRequestRepository;
    private final MatchOfferRepository matchOfferRepository;
    private final UserRepository userRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final RabbitPublisher rabbitPublisher;
    private final TransactionTemplate transactionTemplate;
    private final ChatService chatService;

    public MatchService(
            HelpRequestRepository helpRequestRepository,
            MatchOfferRepository matchOfferRepository,
            UserRepository userRepository,
            RedisTemplate<String, String> redisTemplate,
            RabbitPublisher rabbitPublisher,
            PlatformTransactionManager transactionManager,
            ChatService chatService) {
        this.helpRequestRepository = helpRequestRepository;
        this.matchOfferRepository = matchOfferRepository;
        this.userRepository = userRepository;
        this.redisTemplate = redisTemplate;
        this.rabbitPublisher = rabbitPublisher;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.chatService = chatService;
    }

    @Transactional
    public MatchOfferResponse accept(Long requestId, Long guideId, AcceptRequest req) {
        HelpRequest request = helpRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (request.getStatus() != HelpRequestStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    ErrorCode.REQUEST_NOT_OPEN.getDefaultMessage());
        }

        return matchOfferRepository.findByRequestIdAndGuideId(requestId, guideId)
                .map(existing -> {
                    User guide = userRepository.findById(guideId).orElse(null);
                    return toResponse(existing, guide);
                })
                .orElseGet(() -> {
                    MatchOffer offer = new MatchOffer();
                    offer.setRequestId(requestId);
                    offer.setGuideId(guideId);
                    offer.setStatus(MatchOfferStatus.PENDING);
                    offer.setMessage(req != null ? req.message() : null);
                    MatchOffer saved = matchOfferRepository.save(offer);

                    publishAfterCommit("match.offer.accepted",
                            Map.of("requestId", requestId, "guideId", guideId));

                    User guide = userRepository.findById(guideId).orElse(null);
                    return toResponse(saved, guide);
                });
    }

    public MatchOfferResponse confirm(Long requestId, Long travelerId, ConfirmRequest req) {
        String lockKey = "lock:request:" + requestId;
        String lockValue = UUID.randomUUID().toString();

        boolean acquired = Boolean.TRUE.equals(
                redisTemplate.opsForValue().setIfAbsent(lockKey, lockValue, 5, TimeUnit.SECONDS));
        if (!acquired) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    ErrorCode.MATCH_ALREADY_CONFIRMED.getDefaultMessage());
        }

        try {
            return Objects.requireNonNull(
                    transactionTemplate.execute(status -> doConfirm(requestId, travelerId, req)));
        } finally {
            releaseLock(lockKey, lockValue);
        }
    }

    @Transactional(readOnly = true)
    public List<MatchOfferResponse> getOffers(Long requestId, Long userId, UserRole role) {
        HelpRequest request = helpRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (role == UserRole.TRAVELER) {
            if (!userId.equals(request.getTravelerId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
            }
        } else if (role == UserRole.GUIDE) {
            if (request.getStatus() == HelpRequestStatus.OPEN) {
                // Guide may inspect offers before sending their own; allowed for OPEN.
            } else if (!matchOfferRepository.existsByRequestIdAndGuideId(requestId, userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
            }
        } else {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }

        List<MatchOffer> offers = matchOfferRepository.findByRequestId(requestId);
        List<Long> guideIds = offers.stream().map(MatchOffer::getGuideId).toList();
        Map<Long, User> guideMap = userRepository.findAllById(guideIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        return offers.stream()
                .map(o -> toResponse(o, guideMap.get(o.getGuideId())))
                .toList();
    }

    private MatchOfferResponse doConfirm(Long requestId, Long travelerId, ConfirmRequest req) {
        HelpRequest request = helpRequestRepository.findByIdWithLock(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (!travelerId.equals(request.getTravelerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }

        if (request.getStatus() != HelpRequestStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    ErrorCode.MATCH_ALREADY_CONFIRMED.getDefaultMessage());
        }

        Long guideId = req.guideId();
        MatchOffer targetOffer = matchOfferRepository.findByRequestIdAndGuideId(requestId, guideId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offer not found"));

        targetOffer.setStatus(MatchOfferStatus.CONFIRMED);
        matchOfferRepository.save(targetOffer);

        matchOfferRepository.findByRequestId(requestId).stream()
                .filter(o -> !o.getId().equals(targetOffer.getId()))
                .forEach(o -> {
                    o.setStatus(MatchOfferStatus.REJECTED);
                    matchOfferRepository.save(o);
                });

        request.toMatched();
        helpRequestRepository.save(request);

        chatService.createRoom(requestId, travelerId, guideId);

        publishAfterCommit("match.confirmed",
                Map.of("requestId", requestId, "confirmedGuideId", guideId));

        User guide = userRepository.findById(guideId).orElse(null);
        return toResponse(targetOffer, guide);
    }

    private void publishAfterCommit(String routingKey, Object payload) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    rabbitPublisher.publish(routingKey, payload);
                }
            });
        } else {
            rabbitPublisher.publish(routingKey, payload);
        }
    }

    private void releaseLock(String lockKey, String lockValue) {
        redisTemplate.execute(RELEASE_LOCK_SCRIPT, List.of(lockKey), lockValue);
    }

    private MatchOfferResponse toResponse(MatchOffer offer, User guide) {
        String guideName = guide != null ? guide.getName() : null;
        BigDecimal avgRating = guide != null ? guide.getAvgRating() : BigDecimal.ZERO;
        return new MatchOfferResponse(
                offer.getId(), offer.getRequestId(), offer.getGuideId(),
                guideName, avgRating, offer.getStatus(), offer.getMessage(),
                offer.getCreatedAt());
    }
}
