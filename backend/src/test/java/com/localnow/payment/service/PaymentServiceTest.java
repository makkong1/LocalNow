package com.localnow.payment.service;

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
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.infra.pg.PaymentGateway;
import com.localnow.match.domain.MatchOffer;
import com.localnow.match.domain.MatchOfferStatus;
import com.localnow.match.repository.MatchOfferRepository;
import com.localnow.payment.domain.PaymentIntent;
import com.localnow.payment.domain.PaymentStatus;
import com.localnow.payment.dto.CreatePaymentIntentRequest;
import com.localnow.payment.dto.PaymentIntentResponse;
import com.localnow.payment.repository.PaymentIntentRepository;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.domain.RequestType;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.user.domain.UserRole;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    PaymentIntentRepository paymentIntentRepository;
    @Mock
    HelpRequestRepository helpRequestRepository;
    @Mock
    MatchOfferRepository matchOfferRepository;
    @Mock
    PaymentGateway paymentGateway;

    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService(
                paymentIntentRepository, helpRequestRepository,
                matchOfferRepository, paymentGateway);
    }

    @Test
    void createIntent_succeeds_for_matched_request() {
        HelpRequest request = buildRequest(1L, 10L, HelpRequestStatus.MATCHED, RequestType.GUIDE, 10000L);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));
        when(paymentIntentRepository.findByIdempotencyKey("payment:1")).thenReturn(Optional.empty());

        MatchOffer offer = new MatchOffer();
        offer.setGuideId(20L);
        offer.setStatus(MatchOfferStatus.CONFIRMED);
        when(matchOfferRepository.findByRequestId(1L)).thenReturn(List.of(offer));
        when(paymentGateway.authorize(anyLong(), anyString()))
                .thenReturn(new PaymentGateway.AuthResult("auth-123", true));

        PaymentIntent saved = buildIntent(1L, 1L, 10L, 20L, 10000L, 1500L, PaymentStatus.AUTHORIZED);
        when(paymentIntentRepository.save(any())).thenReturn(saved);

        PaymentIntentResponse response = paymentService.createIntent(10L,
                new CreatePaymentIntentRequest(1L));

        assertThat(response.status()).isEqualTo(PaymentStatus.AUTHORIZED);
        assertThat(response.amountKrw()).isEqualTo(10000L);
    }

    @Test
    void createIntent_returns_existing_intent_idempotently() {
        HelpRequest request = buildRequest(1L, 10L, HelpRequestStatus.MATCHED, RequestType.GUIDE, 10000L);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));

        PaymentIntent existing = buildIntent(99L, 1L, 10L, 20L, 10000L, 1500L, PaymentStatus.AUTHORIZED);
        when(paymentIntentRepository.findByIdempotencyKey("payment:1")).thenReturn(Optional.of(existing));

        PaymentIntentResponse response = paymentService.createIntent(10L,
                new CreatePaymentIntentRequest(1L));

        assertThat(response.status()).isEqualTo(PaymentStatus.AUTHORIZED);
        assertThat(response.amountKrw()).isEqualTo(10000L);
        verify(paymentGateway, never()).authorize(anyLong(), anyString());
    }

    @Test
    void capture_throws_PAYMENT_INVALID_STATE_when_status_is_not_authorized() {
        PaymentIntent intent = buildIntent(1L, 1L, 10L, 20L, 10000L, 1500L, PaymentStatus.CAPTURED);
        when(paymentIntentRepository.findByRequestId(1L)).thenReturn(Optional.of(intent));

        assertThatThrownBy(() -> paymentService.capture(1L, 10L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void getByRequestId_succeeds_for_payer() {
        PaymentIntent intent = buildIntent(1L, 1L, 10L, 20L, 10000L, 1500L, PaymentStatus.AUTHORIZED);
        when(paymentIntentRepository.findByRequestId(1L)).thenReturn(Optional.of(intent));

        PaymentIntentResponse res = paymentService.getByRequestId(1L, 10L, UserRole.TRAVELER);

        assertThat(res.amountKrw()).isEqualTo(10000L);
    }

    @Test
    void getByRequestId_succeeds_for_payee_guide() {
        PaymentIntent intent = buildIntent(1L, 1L, 10L, 20L, 10000L, 1500L, PaymentStatus.AUTHORIZED);
        when(paymentIntentRepository.findByRequestId(1L)).thenReturn(Optional.of(intent));

        PaymentIntentResponse res = paymentService.getByRequestId(1L, 20L, UserRole.GUIDE);

        assertThat(res.guidePayout()).isEqualTo(8500L);
    }

    @Test
    void getByRequestId_forbidden_for_unrelated_user() {
        PaymentIntent intent = buildIntent(1L, 1L, 10L, 20L, 10000L, 1500L, PaymentStatus.AUTHORIZED);
        when(paymentIntentRepository.findByRequestId(1L)).thenReturn(Optional.of(intent));

        assertThatThrownBy(() -> paymentService.getByRequestId(1L, 99L, UserRole.TRAVELER))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }

    private HelpRequest buildRequest(Long id, Long travelerId, HelpRequestStatus status,
            RequestType type, long budget) {
        HelpRequest r = new HelpRequest();
        r.setId(id);
        r.setTravelerId(travelerId);
        r.setRequestType(type);
        r.setLat(37.5);
        r.setLng(127.0);
        r.setStartAt(LocalDateTime.now().plusHours(1));
        r.setDurationMin(60);
        r.setBudgetKrw(budget);
        r.setStatus(status);
        return r;
    }

    private PaymentIntent buildIntent(Long id, Long requestId, Long payerId, Long payeeId,
            long amount, long fee, PaymentStatus status) {
        PaymentIntent p = new PaymentIntent();
        p.setRequestId(requestId);
        p.setPayerId(payerId);
        p.setPayeeId(payeeId);
        p.setAmountKrw(amount);
        p.setPlatformFeeKrw(fee);
        p.setGuidePayout(amount - fee);
        p.setStatus(status);
        p.setIdempotencyKey("payment:" + requestId);
        // id is not settable without a setter, use reflection or just accept null
        return p;
    }
}
