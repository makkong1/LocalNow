package com.localnow.payment.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.localnow.payment.domain.PaymentIntent;

public interface PaymentIntentRepository extends JpaRepository<PaymentIntent, Long> {
    Optional<PaymentIntent> findByRequestId(Long requestId);

    Optional<PaymentIntent> findByIdempotencyKey(String key);
}
