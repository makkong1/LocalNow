package com.localnow.match.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.localnow.common.ApiResponse;
import com.localnow.common.ErrorCode;
import com.localnow.match.dto.AcceptRequest;
import com.localnow.match.dto.ConfirmRequest;
import com.localnow.match.dto.MatchOfferResponse;
import com.localnow.match.service.MatchService;
import com.localnow.user.domain.UserRole;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/requests")
@RequiredArgsConstructor
@Slf4j
public class MatchController {

    private final MatchService matchService;

    @PostMapping("/{requestId}/accept")
    public ResponseEntity<ApiResponse<MatchOfferResponse>> accept(
            @PathVariable @NonNull Long requestId,
            @RequestBody(required = false) @Nullable AcceptRequest body,
            Authentication authentication) {
        if (!isGuide(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.fail(ErrorCode.AUTH_FORBIDDEN,
                            ErrorCode.AUTH_FORBIDDEN.getDefaultMessage()));
        }
        Long guideId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(matchService.accept(requestId, guideId, body)));
    }

    @PostMapping("/{requestId}/confirm")
    public ResponseEntity<ApiResponse<MatchOfferResponse>> confirm(
            @PathVariable @NonNull Long requestId,
            @Valid @RequestBody @NonNull ConfirmRequest body,
            Authentication authentication) {
        if (!isTraveler(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.fail(ErrorCode.AUTH_FORBIDDEN,
                            ErrorCode.AUTH_FORBIDDEN.getDefaultMessage()));
        }
        Long travelerId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(matchService.confirm(requestId, travelerId, body)));
    }

    @GetMapping("/{requestId}/offers")
    public ResponseEntity<ApiResponse<List<MatchOfferResponse>>> getOffers(
            @PathVariable @NonNull Long requestId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        UserRole role = resolveUserRole(authentication);
        return ResponseEntity.ok(ApiResponse.ok(matchService.getOffers(requestId, userId, role)));
    }

    private boolean isGuide(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_GUIDE"));
    }

    private boolean isTraveler(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_TRAVELER"));
    }

    private UserRole resolveUserRole(Authentication authentication) {
        if (isTraveler(authentication)) {
            return UserRole.TRAVELER;
        }
        if (isGuide(authentication)) {
            return UserRole.GUIDE;
        }
        throw new IllegalStateException("Unsupported role in JWT");
    }
}
