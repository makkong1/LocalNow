package com.localnow.user.controller;

import com.localnow.common.ApiResponse;
import com.localnow.common.ErrorCode;
import com.localnow.infra.redis.RedisGeoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/guide")
public class GuideController {

    private final RedisGeoService redisGeoService;

    public GuideController(RedisGeoService redisGeoService) {
        this.redisGeoService = redisGeoService;
    }

    record DutyRequest(@NotNull Boolean onDuty, Double lat, Double lng) {}

    @PostMapping("/duty")
    @PreAuthorize("hasRole('GUIDE')")
    public ResponseEntity<ApiResponse<Void>> setDuty(
            @RequestBody @Valid DutyRequest req,
            Principal principal) {

        long guideId = Long.parseLong(principal.getName());

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
