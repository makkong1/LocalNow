package com.localnow.match.controller;

import com.localnow.common.ApiResponse;
import com.localnow.common.ErrorCode;
import com.localnow.match.dto.AcceptRequest;
import com.localnow.match.dto.ConfirmRequest;
import com.localnow.match.dto.MatchOfferResponse;
import com.localnow.match.service.MatchService;
import com.localnow.user.domain.UserRole;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/requests")
public class MatchController {

    private final MatchService matchService;

    public MatchController(MatchService matchService) {
        this.matchService = matchService;
    }

    @PostMapping("/{requestId}/accept")
    public ResponseEntity<ApiResponse<MatchOfferResponse>> accept(
            @PathVariable Long requestId,
            @RequestBody(required = false) AcceptRequest body,
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
            @PathVariable Long requestId,
            @Valid @RequestBody ConfirmRequest body,
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
            @PathVariable Long requestId,
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
