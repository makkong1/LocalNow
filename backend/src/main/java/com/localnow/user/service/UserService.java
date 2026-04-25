package com.localnow.user.service;

import com.localnow.config.JwtProvider;
import com.localnow.user.domain.User;
import com.localnow.user.dto.AuthResponse;
import com.localnow.user.dto.LoginRequest;
import com.localnow.user.dto.SignupRequest;
import com.localnow.user.dto.UserProfileResponse;
import com.localnow.user.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final JwtProvider jwtProvider;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, JwtProvider jwtProvider, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.jwtProvider = jwtProvider;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AuthResponse register(SignupRequest request) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        User user = new User();
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setName(request.name());
        user.setRole(request.role());
        user.setLanguages(request.languages() != null && !request.languages().isEmpty()
                ? String.join(",", request.languages()) : null);
        user.setCity(request.city());
        user.setAvgRating(BigDecimal.ZERO);
        user.setRatingCount(0);

        User saved = userRepository.save(user);
        String token = jwtProvider.generateToken(saved.getId(), saved.getRole().name());
        return new AuthResponse(token, saved.getId(), saved.getRole().name(), saved.getName());
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        String token = jwtProvider.generateToken(user.getId(), user.getRole().name());
        return new AuthResponse(token, user.getId(), user.getRole().name(), user.getName());
    }

    public UserProfileResponse getProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

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
                user.getRatingCount()
        );
    }
}
