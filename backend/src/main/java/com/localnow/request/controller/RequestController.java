package com.localnow.request.controller;

import com.localnow.common.ApiResponse;
import com.localnow.common.ErrorCode;
import com.localnow.request.dto.CreateRequestRequest;
import com.localnow.request.dto.HelpRequestPageResponse;
import com.localnow.request.dto.HelpRequestResponse;
import com.localnow.request.service.RequestService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/requests")
public class RequestController {

    private final RequestService requestService;

    public RequestController(RequestService requestService) {
        this.requestService = requestService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<HelpRequestResponse>> createRequest(
            @Valid @RequestBody CreateRequestRequest request,
            Authentication authentication) {
        if (!isTraveler(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.fail(ErrorCode.AUTH_FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage()));
        }
        Long userId = (Long) authentication.getPrincipal();
        HelpRequestResponse response = requestService.createRequest(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<HelpRequestResponse>> getRequest(
            @PathVariable Long id,
            Authentication authentication) {
        HelpRequestResponse response = requestService.getRequest(id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<HelpRequestPageResponse>> getMyRequests(
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        HelpRequestPageResponse response = requestService.getMyRequests(userId, cursor, size);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    private boolean isTraveler(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_TRAVELER"));
    }
}
