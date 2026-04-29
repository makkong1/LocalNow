package com.localnow.user.service;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.common.ErrorCode;
import com.localnow.config.security.JwtProvider;
import com.localnow.match.repository.MatchOfferRepository;
import com.localnow.review.dto.ReviewResponse;
import com.localnow.review.service.ReviewService;
import com.localnow.user.domain.Certification;
import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;
import com.localnow.user.dto.AuthResponse;
import com.localnow.user.dto.CertificationResponse;
import com.localnow.user.dto.LoginRequest;
import com.localnow.user.dto.PublicProfileResponse;
import com.localnow.user.dto.SignupRequest;
import com.localnow.user.dto.UserProfileResponse;
import com.localnow.user.repository.CertificationRepository;
import com.localnow.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Transactional(readOnly = true)
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final JwtProvider jwtProvider;
    private final PasswordEncoder passwordEncoder;
    private final CertificationRepository certificationRepository;
    private final MatchOfferRepository matchOfferRepository;
    private final ReviewService reviewService;

    /**
     * 이메일/비밀번호 회원가입. 현재는 DB 저장만 하며 <strong>이메일 인증은 없다</strong>.
     * 추후 링크·코드 인증, {@code email_verified} 또는 활성 플래그를 두면 이 메서드 앞단(또는 별도 플로우)에서 연동할 것.
     */
    @Transactional
    public AuthResponse register(SignupRequest request) {
        if (request.role() == UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 가입된 이메일입니다.");
        }

        User user = new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setName(request.name());
        user.setRole(request.role());
        user.setLanguages(request.languages() != null && !request.languages().isEmpty()
                ? String.join(",", request.languages())
                : null);
        user.setCity(request.city());
        user.setBirthYear(request.birthYear());
        user.setBio(request.bio());
        user.setAvgRating(BigDecimal.ZERO);
        user.setRatingCount(0);

        User saved = userRepository.save(user);
        String token = jwtProvider.generateToken(saved.getId(), saved.getRole().name());
        return new AuthResponse(token, saved.getId(), saved.getRole().name(), saved.getName());
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "이메일 또는 비밀번호가 올바르지 않습니다."));

        if (user.getPassword() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "이 계정은 소셜 로그인(Google 등)으로 가입되었습니다. 해당 방식으로 로그인해 주세요.");
        }
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        String token = jwtProvider.generateToken(user.getId(), user.getRole().name());
        return new AuthResponse(token, user.getId(), user.getRole().name(), user.getName());
    }

    @Transactional
    public UserProfileResponse updateProfileImage(@NonNull Long userId, @Nullable String imageUrl) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));
        user.setProfileImageUrl(imageUrl);
        return getProfile(userId);
    }

    public UserProfileResponse getProfile(@NonNull Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));

        List<String> languages = (user.getLanguages() != null && !user.getLanguages().isBlank())
                ? Arrays.asList(user.getLanguages().split(","))
                : Collections.emptyList();

        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getRole().name(),
                languages,
                user.getCity(),
                user.getAvgRating(),
                user.getRatingCount(),
                user.getProfileImageUrl(),
                user.getBirthYear(),
                user.getBio());
    }

    public PublicProfileResponse getPublicProfile(@NonNull Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        ErrorCode.USER_NOT_FOUND.getDefaultMessage()));

        boolean isGuide = user.getRole() == UserRole.GUIDE;

        List<String> languages = (user.getLanguages() != null && !user.getLanguages().isBlank())
                ? Arrays.asList(user.getLanguages().split(","))
                : Collections.emptyList();

        List<CertificationResponse> certifications = isGuide
                ? certificationRepository.findByUserId(userId).stream()
                        .map(c -> new CertificationResponse(c.getId(), c.getName(), c.getFileUrl(), c.getUploadedAt()))
                        .toList()
                : Collections.emptyList();

        int completedCount = isGuide
                ? (int) matchOfferRepository.countCompletedByGuideId(userId)
                : 0;

        List<ReviewResponse> recentReviews = reviewService.getRecentReviews(userId, 5);

        return new PublicProfileResponse(
                user.getId(),
                user.getName(),
                user.getProfileImageUrl(),
                user.getBirthYear() != null ? (int) user.getBirthYear() : null,
                user.getBio(),
                user.getRole().name(),
                languages,
                user.getAvgRating(),
                user.getRatingCount(),
                completedCount,
                certifications,
                recentReviews);
    }
}
