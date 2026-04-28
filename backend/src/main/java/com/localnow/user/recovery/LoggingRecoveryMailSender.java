package com.localnow.user.recovery;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LoggingRecoveryMailSender implements RecoveryMailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingRecoveryMailSender.class);

    @Override
    public void sendOtp(String toEmail, RecoveryPurpose purpose, String otpCode) {
        log.info(
                "[recovery-mail] to={} purpose={} otp={} (실제 SMTP 미연동 시 콘솔에서 OTP 확인)",
                toEmail, purpose, otpCode);
    }
}
