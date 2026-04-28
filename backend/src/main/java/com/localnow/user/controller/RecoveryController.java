package com.localnow.user.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.localnow.common.ApiResponse;
import com.localnow.user.dto.EmailHintStartRequest;
import com.localnow.user.dto.EmailHintVerifyRequest;
import com.localnow.user.dto.EmailHintVerifyResponse;
import com.localnow.user.dto.PasswordResetConfirmRequest;
import com.localnow.user.dto.PasswordResetStartRequest;
import com.localnow.user.dto.SimpleTicketResponse;
import com.localnow.user.recovery.RecoveryService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth")
public class RecoveryController {

    private final RecoveryService recoveryService;

    public RecoveryController(RecoveryService recoveryService) {
        this.recoveryService = recoveryService;
    }

    @PostMapping("/recovery/email-hint/request")
    public ResponseEntity<ApiResponse<SimpleTicketResponse>> requestEmailHint(
            @Valid @RequestBody EmailHintStartRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(recoveryService.startEmailHint(body)));
    }

    @PostMapping("/recovery/email-hint/verify")
    public ResponseEntity<ApiResponse<EmailHintVerifyResponse>> verifyEmailHint(
            @Valid @RequestBody EmailHintVerifyRequest body) {
        return ResponseEntity.ok(ApiResponse.ok(recoveryService.verifyEmailHint(body)));
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<ApiResponse<SimpleTicketResponse>> requestPasswordReset(
            @Valid @RequestBody PasswordResetStartRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(recoveryService.startPasswordReset(body)));
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<ApiResponse<Void>> confirmPasswordReset(
            @Valid @RequestBody PasswordResetConfirmRequest body) {
        recoveryService.confirmPasswordReset(body);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
