package com.localnow.request.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.localnow.common.ApiResponse;
import com.localnow.common.ErrorCode;
import static com.localnow.common.security.AuthenticationUserRoles.isGuide;
import static com.localnow.common.security.AuthenticationUserRoles.isTraveler;
import static com.localnow.common.security.AuthenticationUserRoles.resolveUserRole;
import com.localnow.request.dto.CreateRequestRequest;
import com.localnow.request.dto.HelpRequestPageResponse;
import com.localnow.request.dto.HelpRequestResponse;
import com.localnow.request.service.RequestService;
import com.localnow.user.domain.UserRole;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/requests")
public class RequestController {

    private final RequestService requestService;

    public RequestController(RequestService requestService) {
        this.requestService = requestService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<HelpRequestResponse>> createRequest(
            @Valid @RequestBody @NonNull CreateRequestRequest request,
            Authentication authentication) {
        if (!isTraveler(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.fail(ErrorCode.AUTH_FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage()));
        }
        Long userId = (Long) authentication.getPrincipal();
        HelpRequestResponse response = requestService.createRequest(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @GetMapping("/open")
    public ResponseEntity<ApiResponse<HelpRequestPageResponse>> getOpenRequests(
            @RequestParam(name = "cursor", required = false) @Nullable Long cursor,
            @RequestParam(name = "size", defaultValue = "10") int size,
            Authentication authentication) {
        if (!isGuide(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.fail(ErrorCode.AUTH_FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage()));
        }
        HelpRequestPageResponse response = requestService.getOpenRequests(cursor, size);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<HelpRequestResponse>> getRequest(
            @PathVariable("id") @NonNull Long id,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        UserRole role = resolveUserRole(authentication);
        HelpRequestResponse response = requestService.getRequestForUser(id, userId, role);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<ApiResponse<HelpRequestResponse>> startRequest(
            @PathVariable("id") @NonNull Long id,
            Authentication authentication) {
        if (!isGuide(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.fail(ErrorCode.AUTH_FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage()));
        }
        Long userId = (Long) authentication.getPrincipal();
        HelpRequestResponse response = requestService.startRequest(id, userId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> cancelRequest(
            @PathVariable("id") @NonNull Long id,
            Authentication authentication) {
        if (!isTraveler(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.fail(ErrorCode.AUTH_FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage()));
        }
        Long userId = (Long) authentication.getPrincipal();
        requestService.cancelRequest(id, userId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<HelpRequestPageResponse>> getMyRequests(
            @RequestParam(name = "cursor", required = false) @Nullable Long cursor,
            @RequestParam(name = "size", defaultValue = "10") int size,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        HelpRequestPageResponse response = requestService.getMyRequests(userId, cursor, size);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }
}
