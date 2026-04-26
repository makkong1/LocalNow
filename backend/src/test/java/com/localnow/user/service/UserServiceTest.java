package com.localnow.user.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.common.ErrorCode;
import com.localnow.config.security.JwtProvider;
import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;
import com.localnow.user.dto.AuthResponse;
import com.localnow.user.dto.LoginRequest;
import com.localnow.user.dto.SignupRequest;
import com.localnow.user.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtProvider jwtProvider;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, jwtProvider, passwordEncoder);
    }

    @Test
    void register_success_returns_token() {
        SignupRequest req = new SignupRequest(
                "test@test.com", "password123", "Test User",
                UserRole.TRAVELER, List.of("ko", "en"), "Seoul");

        User savedUser = buildUser(1L, "test@test.com", "Test User", UserRole.TRAVELER);

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtProvider.generateToken(1L, "TRAVELER")).thenReturn("mock-token");

        AuthResponse result = userService.register(req);

        assertThat(result.accessToken()).isEqualTo("mock-token");
        assertThat(result.userId()).isEqualTo(1L);
        assertThat(result.role()).isEqualTo("TRAVELER");
    }

    @Test
    void login_success_returns_token() {
        String rawPassword = "password123";
        String encoded = passwordEncoder.encode(rawPassword);

        User user = buildUser(1L, "test@test.com", "Test User", UserRole.TRAVELER);
        user.setPassword(encoded);

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(user));
        when(jwtProvider.generateToken(1L, "TRAVELER")).thenReturn("mock-token");

        AuthResponse result = userService.login(new LoginRequest("test@test.com", rawPassword));

        assertThat(result.accessToken()).isEqualTo("mock-token");
    }

    @Test
    void register_adminRole_forbidden() {
        SignupRequest req = new SignupRequest(
                "admin@test.com", "password123", "Nope",
                UserRole.ADMIN, null, null);

        assertThatThrownBy(() -> userService.register(req))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> {
                    var ex = (ResponseStatusException) e;
                    assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(ex.getReason()).isEqualTo(ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
                });
    }

    @Test
    void register_duplicateEmail_throws_conflict() {
        SignupRequest req = new SignupRequest(
                "test@test.com", "password123", "Test User",
                UserRole.TRAVELER, null, null);

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> userService.register(req))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void login_oauthOnlyAccount_cannotUsePassword() {
        User user = buildUser(1L, "oauth@test.com", "O", UserRole.TRAVELER);
        user.setPassword(null);
        when(userRepository.findByEmail("oauth@test.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.login(new LoginRequest("oauth@test.com", "any")))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void login_wrongPassword_throws_unauthorized() {
        User user = buildUser(1L, "test@test.com", "Test User", UserRole.TRAVELER);
        user.setPassword(passwordEncoder.encode("correct-password"));

        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.login(new LoginRequest("test@test.com", "wrong-password")))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void register_guide_initialRatingIsZero() {
        SignupRequest req = new SignupRequest(
                "guide@test.com", "password123", "Guide User",
                UserRole.GUIDE, null, null);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);

        User savedUser = buildUser(2L, "guide@test.com", "Guide User", UserRole.GUIDE);
        when(userRepository.findByEmail("guide@test.com")).thenReturn(Optional.empty());
        when(userRepository.save(captor.capture())).thenReturn(savedUser);
        when(jwtProvider.generateToken(anyLong(), anyString())).thenReturn("token");

        userService.register(req);

        User captured = captor.getValue();
        assertThat(captured.getAvgRating()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(captured.getRatingCount()).isEqualTo(0);
    }

    private User buildUser(Long id, String email, String name, UserRole role) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setName(name);
        user.setRole(role);
        user.setAvgRating(BigDecimal.ZERO);
        user.setRatingCount(0);
        return user;
    }
}
