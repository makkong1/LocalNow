package com.localnow.payment.service;

import com.localnow.common.ErrorCode;
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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PaymentService {

    private static final long FEE_RATE_EMERGENCY_NUM = 25;
    private static final long FEE_RATE_STANDARD_NUM = 15;
    private static final long FEE_RATE_DENOM = 100;

    private final PaymentIntentRepository paymentIntentRepository;
    private final HelpRequestRepository helpRequestRepository;
    private final MatchOfferRepository matchOfferRepository;
    private final PaymentGateway paymentGateway;

    public PaymentService(
            PaymentIntentRepository paymentIntentRepository,
            HelpRequestRepository helpRequestRepository,
            MatchOfferRepository matchOfferRepository,
            PaymentGateway paymentGateway) {
        this.paymentIntentRepository = paymentIntentRepository;
        this.helpRequestRepository = helpRequestRepository;
        this.matchOfferRepository = matchOfferRepository;
        this.paymentGateway = paymentGateway;
    }

    @Transactional
    public PaymentIntentResponse createIntent(Long travelerId, CreatePaymentIntentRequest req) {
        Long requestId = req.requestId();
        HelpRequest request = helpRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (request.getStatus() != HelpRequestStatus.MATCHED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    ErrorCode.PAYMENT_INVALID_STATE.getDefaultMessage());
        }

        if (!travelerId.equals(request.getTravelerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }

        String idempotencyKey = "payment:" + requestId;
        return paymentIntentRepository.findByIdempotencyKey(idempotencyKey)
                .map(this::toResponse)
                .orElseGet(() -> {
                    Long guideId = matchOfferRepository.findByRequestId(requestId).stream()
                            .filter(o -> o.getStatus() == MatchOfferStatus.CONFIRMED)
                            .map(MatchOffer::getGuideId)
                            .findFirst()
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                    "Confirmed offer not found"));

                    long amountKrw = request.getBudgetKrw();
                    long feeRate = request.getRequestType() == RequestType.EMERGENCY
                            ? FEE_RATE_EMERGENCY_NUM : FEE_RATE_STANDARD_NUM;
                    long platformFeeKrw = (amountKrw * feeRate + FEE_RATE_DENOM / 2) / FEE_RATE_DENOM;
                    long guidePayout = amountKrw - platformFeeKrw;

                    PaymentGateway.AuthResult auth = paymentGateway.authorize(amountKrw, idempotencyKey);
                    if (!auth.success()) {
                        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                                "Payment authorization failed");
                    }

                    PaymentIntent intent = new PaymentIntent();
                    intent.setRequestId(requestId);
                    intent.setPayerId(travelerId);
                    intent.setPayeeId(guideId);
                    intent.setAmountKrw(amountKrw);
                    intent.setPlatformFeeKrw(platformFeeKrw);
                    intent.setGuidePayout(guidePayout);
                    intent.setStatus(PaymentStatus.AUTHORIZED);
                    intent.setAuthorizationId(auth.authorizationId());
                    intent.setIdempotencyKey(idempotencyKey);

                    return toResponse(paymentIntentRepository.save(intent));
                });
    }

    @Transactional
    public PaymentIntentResponse capture(Long requestId, Long travelerId) {
        PaymentIntent intent = paymentIntentRepository.findByRequestId(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Payment intent not found"));

        if (!travelerId.equals(intent.getPayerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }

        if (intent.getStatus() != PaymentStatus.AUTHORIZED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    ErrorCode.PAYMENT_INVALID_STATE.getDefaultMessage());
        }

        PaymentGateway.CaptureResult result = paymentGateway.capture(intent.getAuthorizationId());
        if (!result.success()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Payment capture failed");
        }

        intent.capture(result.captureId());
        paymentIntentRepository.save(intent);

        HelpRequest request = helpRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        request.toCompleted();
        helpRequestRepository.save(request);

        return toResponse(intent);
    }

    @Transactional
    public PaymentIntentResponse refund(Long requestId, Long travelerId) {
        PaymentIntent intent = paymentIntentRepository.findByRequestId(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Payment intent not found"));

        if (!travelerId.equals(intent.getPayerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }

        if (intent.getStatus() != PaymentStatus.CAPTURED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    ErrorCode.PAYMENT_INVALID_STATE.getDefaultMessage());
        }

        PaymentGateway.RefundResult result = paymentGateway.refund(intent.getCaptureId(), intent.getAmountKrw());
        if (!result.success()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Refund failed");
        }

        intent.refund();
        return toResponse(paymentIntentRepository.save(intent));
    }

    @Transactional(readOnly = true)
    public PaymentIntentResponse getByRequestId(Long requestId) {
        return paymentIntentRepository.findByRequestId(requestId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Payment intent not found"));
    }

    private PaymentIntentResponse toResponse(PaymentIntent intent) {
        return new PaymentIntentResponse(intent.getId(), intent.getRequestId(),
                intent.getAmountKrw(), intent.getPlatformFeeKrw(), intent.getGuidePayout(),
                intent.getStatus(), intent.getCreatedAt());
    }
}
