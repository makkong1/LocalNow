package com.localnow.user.controller;

import java.util.Objects;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.localnow.common.ApiResponse;
import com.localnow.common.ErrorCode;
import com.localnow.infra.redis.RedisGeoService;
import com.localnow.user.dto.DutyRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/guide")
@RequiredArgsConstructor
public class GuideController {

    private final RedisGeoService redisGeoService;

    @PostMapping("/duty")
    @PreAuthorize("hasRole('GUIDE')")
    public ResponseEntity<ApiResponse<Void>> setDuty(
            @RequestBody @Valid DutyRequest req,
            Authentication authentication) {

        long guideId = Objects.requireNonNull((Long) authentication.getPrincipal());

        if (Boolean.TRUE.equals(req.onDuty())) {
            if (req.lat() == null || req.lng() == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.fail(ErrorCode.VALIDATION_FAILED,
                                "lat and lng are required when onDuty=true"));
            }
            redisGeoService.addGuide(guideId, req.lat(), req.lng());
        } else {
            redisGeoService.removeGuide(guideId);
        }

        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
