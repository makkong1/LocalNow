package com.localnow.payment.controller;

import com.localnow.common.ApiResponse;
import com.localnow.payment.dto.CreatePaymentIntentRequest;
import com.localnow.payment.dto.PaymentIntentResponse;
import com.localnow.payment.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/intent")
    public ResponseEntity<ApiResponse<PaymentIntentResponse>> createIntent(
            @Valid @RequestBody CreatePaymentIntentRequest request,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        PaymentIntentResponse response = paymentService.createIntent(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @PostMapping("/{requestId}/capture")
    public ResponseEntity<ApiResponse<PaymentIntentResponse>> capture(
            @PathVariable Long requestId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(paymentService.capture(requestId, userId)));
    }

    @PostMapping("/{requestId}/refund")
    public ResponseEntity<ApiResponse<PaymentIntentResponse>> refund(
            @PathVariable Long requestId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(paymentService.refund(requestId, userId)));
    }

    @GetMapping("/{requestId}")
    public ResponseEntity<ApiResponse<PaymentIntentResponse>> get(
            @PathVariable Long requestId,
            Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(paymentService.getByRequestId(requestId)));
    }
}
