package com.localnow.user.recovery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;
import com.localnow.user.dto.EmailHintStartRequest;
import com.localnow.user.dto.EmailHintVerifyRequest;
import com.localnow.user.dto.PasswordResetConfirmRequest;
import com.localnow.user.dto.PasswordResetStartRequest;
import com.localnow.user.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class RecoveryServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOps;

    private RecoveryTicketCodec codec = new RecoveryTicketCodec();

    @Mock
    private RecoveryMailSender mailSender;

    @Mock
    private PasswordEncoder passwordEncoder;

    private RecoveryService recoveryService;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        recoveryService = new RecoveryService(userRepository, redisTemplate, codec, mailSender, passwordEncoder);
    }

    @Test
    void emailHint_request_sendsMail_andStoresTicket() {
        User u = user(1L, "a@b.com");
        when(userRepository.findByNameAndCity("Kim", "Seoul")).thenReturn(List.of(u));
        when(passwordEncoder.encode(anyString())).thenReturn("$hash");

        var res = recoveryService.startEmailHint(new EmailHintStartRequest("Kim", "Seoul"));

        assertThat(res.ticketId()).isNotBlank();
        ArgumentCaptor<String> keyCap = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> jsonCap = ArgumentCaptor.forClass(String.class);
        verify(valueOps).set(keyCap.capture(), jsonCap.capture(), any(Duration.class));
        assertThat(keyCap.getValue()).startsWith("recovery:ticket:");
        RecoveryTicket t = codec.deserialize(jsonCap.getValue());
        assertThat(t.userId()).isEqualTo(1L);
        assertThat(t.purpose()).isEqualTo(RecoveryPurpose.EMAIL_HINT);
        verify(mailSender).sendOtp(eq("a@b.com"), eq(RecoveryPurpose.EMAIL_HINT), anyString());
    }

    @Test
    void emailHint_noMatch_badRequest() {
        when(userRepository.findByNameAndCity("X", "Y")).thenReturn(List.of());

        assertThatThrownBy(() -> recoveryService.startEmailHint(new EmailHintStartRequest("X", "Y")))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void passwordReset_confirm_updatesPassword() {
        User u = user(2L, "u@u.com");
        u.setPassword("old");
        RecoveryTicket ticket = new RecoveryTicket(2L, "$bcrypt", RecoveryPurpose.PASSWORD_RESET);
        when(valueOps.get("recovery:ticket:t1")).thenReturn(codec.serialize(ticket));
        when(passwordEncoder.matches(eq("123456"), eq("$bcrypt"))).thenReturn(true);
        when(passwordEncoder.encode("newpw")).thenReturn("$new");
        when(userRepository.findById(2L)).thenReturn(Optional.of(u));

        recoveryService.confirmPasswordReset(
                new PasswordResetConfirmRequest("t1", "123456", "newpw"));

        assertThat(u.getPassword()).isEqualTo("$new");
        verify(redisTemplate).delete("recovery:ticket:t1");
    }

    @Test
    void passwordReset_unknownEmail_badRequest() {
        when(userRepository.findByEmail("nope@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> recoveryService.startPasswordReset(new PasswordResetStartRequest("nope@test.com")))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    private static User user(Long id, String email) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        u.setName("N");
        u.setRole(UserRole.TRAVELER);
        return u;
    }
}
