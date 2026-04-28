package com.localnow.match.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mock;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.chat.service.ChatService;
import com.localnow.infra.rabbit.RabbitPublisher;
import com.localnow.match.domain.MatchOffer;
import com.localnow.match.domain.MatchOfferStatus;
import com.localnow.match.dto.AcceptRequest;
import com.localnow.match.dto.ConfirmRequest;
import com.localnow.match.dto.MatchOfferResponse;
import com.localnow.match.repository.MatchOfferRepository;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.domain.RequestType;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.user.domain.UserRole;
import com.localnow.user.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class MatchServiceTest {

    @Mock
    HelpRequestRepository helpRequestRepository;
    @Mock
    MatchOfferRepository matchOfferRepository;
    @Mock
    UserRepository userRepository;
    @Mock
    RedisTemplate<String, String> redisTemplate;
    @Mock
    RabbitPublisher rabbitPublisher;
    @Mock
    TransactionTemplate transactionTemplate;
    @Mock
    ChatService chatService;

    private MatchService matchService;

    @BeforeEach
    void setUp() {
        matchService = new MatchService(
                helpRequestRepository, matchOfferRepository, userRepository,
                redisTemplate, rabbitPublisher, transactionTemplate, chatService,
                Duration.ofSeconds(5));
        lenient().doAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(null);
        }).when(transactionTemplate).execute(any());
    }

    @Test
    void accept_creates_pending_offer_when_request_is_open() {
        HelpRequest request = buildRequest(1L, 42L, HelpRequestStatus.OPEN);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));
        when(matchOfferRepository.findByRequestIdAndGuideId(1L, 10L)).thenReturn(Optional.empty());

        MatchOffer savedOffer = buildOffer(5L, 1L, 10L, MatchOfferStatus.PENDING);
        when(matchOfferRepository.save(any(MatchOffer.class))).thenReturn(savedOffer);
        when(userRepository.findById(10L)).thenReturn(Optional.empty());

        MatchOfferResponse response = matchService.accept(1L, 10L, new AcceptRequest(null));

        assertThat(response.status()).isEqualTo(MatchOfferStatus.PENDING);
        assertThat(response.guideId()).isEqualTo(10L);
        assertThat(response.id()).isEqualTo(5L);
        verify(matchOfferRepository).save(any(MatchOffer.class));
    }

    @Test
    void accept_throws_REQUEST_NOT_OPEN_when_request_is_not_open() {
        HelpRequest request = buildRequest(1L, 42L, HelpRequestStatus.MATCHED);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));

        assertThatThrownBy(() -> matchService.accept(1L, 10L, new AcceptRequest(null)))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));

        verify(matchOfferRepository, never()).save(any());
    }

    @Test
    void accept_returns_existing_offer_when_same_guide_accepts_twice() {
        HelpRequest request = buildRequest(1L, 42L, HelpRequestStatus.OPEN);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));

        MatchOffer existing = buildOffer(99L, 1L, 10L, MatchOfferStatus.PENDING);
        when(matchOfferRepository.findByRequestIdAndGuideId(1L, 10L)).thenReturn(Optional.of(existing));
        when(userRepository.findById(10L)).thenReturn(Optional.empty());

        MatchOfferResponse response = matchService.accept(1L, 10L, new AcceptRequest("Hello"));

        assertThat(response.id()).isEqualTo(99L);
        assertThat(response.status()).isEqualTo(MatchOfferStatus.PENDING);
        verify(matchOfferRepository, never()).save(any());
    }

    @Test
    void 정상_수락_offer_저장됨() {
        HelpRequest request = buildRequest(1L, 42L, HelpRequestStatus.OPEN);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));
        when(matchOfferRepository.findByRequestIdAndGuideId(1L, 10L)).thenReturn(Optional.empty());

        MatchOffer savedOffer = buildOffer(5L, 1L, 10L, MatchOfferStatus.PENDING);
        when(matchOfferRepository.save(any(MatchOffer.class))).thenReturn(savedOffer);
        when(userRepository.findById(10L)).thenReturn(Optional.empty());

        MatchOfferResponse response = matchService.accept(1L, 10L, new AcceptRequest(null));

        assertThat(response.status()).isEqualTo(MatchOfferStatus.PENDING);
        assertThat(response.guideId()).isEqualTo(10L);
        assertThat(response.id()).isEqualTo(5L);
        verify(matchOfferRepository).save(any(MatchOffer.class));
    }

    @Test
    void 멱등_동일_가이드_재호출_기존_offer_반환() {
        HelpRequest request = buildRequest(1L, 42L, HelpRequestStatus.OPEN);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));

        MatchOffer existing = buildOffer(99L, 1L, 10L, MatchOfferStatus.PENDING);
        when(matchOfferRepository.findByRequestIdAndGuideId(1L, 10L)).thenReturn(Optional.of(existing));
        when(userRepository.findById(10L)).thenReturn(Optional.empty());

        MatchOfferResponse response = matchService.accept(1L, 10L, new AcceptRequest("Hello"));

        assertThat(response.id()).isEqualTo(99L);
        assertThat(response.status()).isEqualTo(MatchOfferStatus.PENDING);
        verify(matchOfferRepository, never()).save(any());
    }

    @Test
    void 예외_OPEN_아닌_요청_수락_불가() {
        HelpRequest request = buildRequest(1L, 42L, HelpRequestStatus.MATCHED);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));

        assertThatThrownBy(() -> matchService.accept(1L, 10L, new AcceptRequest(null)))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));

        verify(matchOfferRepository, never()).save(any());
    }

    @Test
    void accept_동시_수락_중복키_예외_시_재조회_반환() {
        HelpRequest request = buildRequest(1L, 42L, HelpRequestStatus.OPEN);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));
        when(matchOfferRepository.findByRequestIdAndGuideId(1L, 10L))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(buildOffer(7L, 1L, 10L, MatchOfferStatus.PENDING)));
        when(matchOfferRepository.save(any(MatchOffer.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate key"));
        when(userRepository.findById(10L)).thenReturn(Optional.empty());

        MatchOfferResponse response = matchService.accept(1L, 10L, new AcceptRequest(null));

        assertThat(response.id()).isEqualTo(7L);
    }

    @Test
    void getOffers_traveler_sees_offers_for_own_request() {
        HelpRequest request = buildRequest(1L, 42L, HelpRequestStatus.OPEN);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));
        when(matchOfferRepository.findByRequestId(1L)).thenReturn(List.of());
        when(userRepository.findAllById(any())).thenReturn(List.of());

        assertThat(matchService.getOffers(1L, 42L, UserRole.TRAVELER)).isEmpty();
    }

    @Test
    void getOffers_guide_forbidden_when_not_involved() {
        HelpRequest request = buildRequest(1L, 42L, HelpRequestStatus.MATCHED);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));
        when(matchOfferRepository.existsByRequestIdAndGuideId(1L, 99L)).thenReturn(false);

        assertThatThrownBy(() -> matchService.getOffers(1L, 99L, UserRole.GUIDE))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));

        verify(matchOfferRepository, never()).findByRequestId(anyLong());
    }

    @Test
    void confirm_passes_configured_ttl_to_redis_setIfAbsent() {
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOps = org.mockito.Mockito.mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.setIfAbsent(anyString(), anyString(), eq(Duration.ofSeconds(5)))).thenReturn(false);

        assertThatThrownBy(() -> matchService.confirm(1L, 10L, new ConfirmRequest(20L)))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));

        verify(valueOps).setIfAbsent(eq("lock:request:1"), anyString(), eq(Duration.ofSeconds(5)));
    }

    private HelpRequest buildRequest(Long id, Long travelerId, HelpRequestStatus status) {
        HelpRequest r = new HelpRequest();
        r.setId(id);
        r.setTravelerId(travelerId);
        r.setRequestType(RequestType.GUIDE);
        r.setLat(37.5665);
        r.setLng(126.9780);
        r.setStartAt(LocalDateTime.now().plusHours(1));
        r.setDurationMin(60);
        r.setBudgetKrw(10000L);
        r.setStatus(status);
        return r;
    }

    private MatchOffer buildOffer(Long id, Long requestId, Long guideId, MatchOfferStatus status) {
        MatchOffer o = new MatchOffer();
        o.setId(id);
        o.setRequestId(requestId);
        o.setGuideId(guideId);
        o.setStatus(status);
        return o;
    }
}
