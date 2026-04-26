package com.localnow.admin.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.localnow.admin.dto.AdminSummaryResponse;
import com.localnow.admin.service.AdminService;
import com.localnow.common.ApiResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<AdminSummaryResponse>> summary() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getSummary()));
    }
}
