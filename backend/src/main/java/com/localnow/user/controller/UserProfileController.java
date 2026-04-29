package com.localnow.user.controller;

import com.localnow.common.ApiResponse;
import com.localnow.infra.storage.FileStorageService;
import com.localnow.user.dto.PublicProfileResponse;
import com.localnow.user.dto.UserProfileResponse;
import com.localnow.user.service.UserService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/users")
public class UserProfileController {

    private final UserService userService;
    private final FileStorageService fileStorageService;

    public UserProfileController(UserService userService, FileStorageService fileStorageService) {
        this.userService = userService;
        this.fileStorageService = fileStorageService;
    }

    @PostMapping(value = "/profile-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<UserProfileResponse>> uploadProfileImage(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {

        Long userId = (Long) authentication.getPrincipal();

        // 기존 이미지 URL을 조회해 두고 새 파일 저장 후 삭제
        UserProfileResponse current = userService.getProfile(userId);
        String newUrl = fileStorageService.storeProfileImage(file);

        UserProfileResponse updated = userService.updateProfileImage(userId, newUrl);

        if (current.profileImageUrl() != null) {
            fileStorageService.delete(current.profileImageUrl());
        }

        return ResponseEntity.ok(ApiResponse.ok(updated));
    }

    @GetMapping("/{userId}/profile")
    public ResponseEntity<ApiResponse<PublicProfileResponse>> getPublicProfile(
            @PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getPublicProfile(userId)));
    }
}
