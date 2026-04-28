package com.localnow.user.recovery;

/**
 * 인증번호 메일 발송. 실SMTP 연동 전까지 로그로만 출력(OTP 확인 가능).
 */
public interface RecoveryMailSender {

    void sendOtp(String toEmail, RecoveryPurpose purpose, String otpCode);
}
