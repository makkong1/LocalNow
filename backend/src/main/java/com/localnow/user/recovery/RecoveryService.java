package com.localnow.user.recovery;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.user.domain.User;
import com.localnow.user.dto.EmailHintStartRequest;
import com.localnow.user.dto.EmailHintVerifyRequest;
import com.localnow.user.dto.EmailHintVerifyResponse;
import com.localnow.user.dto.PasswordResetConfirmRequest;
import com.localnow.user.dto.PasswordResetStartRequest;
import com.localnow.user.dto.SimpleTicketResponse;
import com.localnow.user.repository.UserRepository;

@Service
public class RecoveryService {

    private static final Duration TICKET_TTL = Duration.ofMinutes(10);
    private static final String KEY_PREFIX = "recovery:ticket:";

    private final UserRepository userRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final RecoveryTicketCodec codec;
    private final RecoveryMailSender mailSender;
    private final PasswordEncoder passwordEncoder;

    private final SecureRandom secureRandom = new SecureRandom();

    public RecoveryService(
            UserRepository userRepository,
            RedisTemplate<String, String> redisTemplate,
            RecoveryTicketCodec codec,
            RecoveryMailSender mailSender,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.redisTemplate = redisTemplate;
        this.codec = codec;
        this.mailSender = mailSender;
        this.passwordEncoder = passwordEncoder;
    }

    public SimpleTicketResponse startEmailHint(EmailHintStartRequest req) {
        String name = req.name().trim();
        String city = req.city().trim();
        List<User> list = userRepository.findByNameAndCity(name, city);
        if (list.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "일치하는 계정이 없습니다.");
        }
        if (list.size() > 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "동일한 이름·도시로 여러 계정이 있습니다. 고객지원을 이용해 주세요.");
        }
        User user = list.get(0);
        return storeTicketAndSendMail(user, RecoveryPurpose.EMAIL_HINT);
    }

    public EmailHintVerifyResponse verifyEmailHint(EmailHintVerifyRequest req) {
        RecoveryTicket ticket = loadTicket(req.ticketId(), RecoveryPurpose.EMAIL_HINT);
        if (!passwordEncoder.matches(req.code(), ticket.otpHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "인증번호가 올바르지 않습니다.");
        }
        redisTemplate.delete(KEY_PREFIX + req.ticketId());
        User user = userRepository.findById(ticket.userId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));
        return new EmailHintVerifyResponse(user.getEmail());
    }

    public SimpleTicketResponse startPasswordReset(PasswordResetStartRequest req) {
        String email = req.email().trim();
        User user = userRepository.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "등록되지 않은 이메일입니다."));
        if (user.getPassword() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "소셜 로그인만 사용 중인 계정입니다. Google/GitHub 로 로그인해 주세요.");
        }
        return storeTicketAndSendMail(user, RecoveryPurpose.PASSWORD_RESET);
    }

    @Transactional
    public void confirmPasswordReset(PasswordResetConfirmRequest req) {
        RecoveryTicket ticket = loadTicket(req.ticketId(), RecoveryPurpose.PASSWORD_RESET);
        if (!passwordEncoder.matches(req.code(), ticket.otpHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "인증번호가 올바르지 않습니다.");
        }
        User user = userRepository.findById(ticket.userId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));
        user.setPassword(passwordEncoder.encode(req.newPassword()));
        redisTemplate.delete(KEY_PREFIX + req.ticketId());
    }

    private SimpleTicketResponse storeTicketAndSendMail(User user, RecoveryPurpose purpose) {
        String ticketId = UUID.randomUUID().toString();
        String otp = randomOtp();
        RecoveryTicket ticket = new RecoveryTicket(user.getId(), passwordEncoder.encode(otp), purpose);
        redisTemplate.opsForValue().set(KEY_PREFIX + ticketId, codec.serialize(ticket), TICKET_TTL);
        mailSender.sendOtp(user.getEmail(), purpose, otp);
        return new SimpleTicketResponse(ticketId);
    }

    private RecoveryTicket loadTicket(String ticketId, RecoveryPurpose expected) {
        String json = redisTemplate.opsForValue().get(KEY_PREFIX + ticketId);
        if (json == null || json.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "만료되었거나 잘못된 요청입니다.");
        }
        RecoveryTicket t = codec.deserialize(json);
        if (t.purpose() != expected) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "만료되었거나 잘못된 요청입니다.");
        }
        return t;
    }

    private String randomOtp() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }
}
