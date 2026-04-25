package com.localnow.payment.repository;

import com.localnow.payment.domain.PaymentIntent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentIntentRepository extends JpaRepository<PaymentIntent, Long> {
    Optional<PaymentIntent> findByRequestId(Long requestId);
    Optional<PaymentIntent> findByIdempotencyKey(String key);
}
