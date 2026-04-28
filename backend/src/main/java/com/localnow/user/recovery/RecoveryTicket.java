package com.localnow.user.recovery;

/**
 * Redis 에 저장되는 일회용 인증 티켓(JSON 직렬화).
 */
public record RecoveryTicket(long userId, String otpHash, RecoveryPurpose purpose) {}
