package com.localnow.user.controller;

import java.util.List;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.localnow.common.ApiResponse;
import com.localnow.common.ErrorCode;
import com.localnow.infra.redis.RedisGeoService;
import com.localnow.user.dto.CertificationResponse;
import com.localnow.user.dto.DutyRequest;
import com.localnow.user.service.CertificationService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/guide")
@RequiredArgsConstructor
public class GuideController {

    private final RedisGeoService redisGeoService;
    private final CertificationService certificationService;

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

    @PostMapping(value = "/certifications", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('GUIDE')")
    public ResponseEntity<ApiResponse<CertificationResponse>> uploadCertification(
            @RequestParam("file") MultipartFile file,
            @RequestParam("name") String name,
            Authentication authentication) {

        Long guideId = (Long) authentication.getPrincipal();
        CertificationResponse response = certificationService.upload(guideId, name, file);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/certifications")
    @PreAuthorize("hasRole('GUIDE')")
    public ResponseEntity<ApiResponse<List<CertificationResponse>>> listCertifications(
            Authentication authentication) {

        Long guideId = (Long) authentication.getPrincipal();
        List<CertificationResponse> list = certificationService.list(guideId);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @DeleteMapping("/certifications/{id}")
    @PreAuthorize("hasRole('GUIDE')")
    public ResponseEntity<ApiResponse<Void>> deleteCertification(
            @PathVariable Long id,
            Authentication authentication) {

        Long guideId = (Long) authentication.getPrincipal();
        certificationService.delete(guideId, id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
