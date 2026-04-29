package com.localnow.user.repository;

import com.localnow.user.domain.Certification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CertificationRepository extends JpaRepository<Certification, Long> {
    List<Certification> findByUserId(Long userId);
    boolean existsByIdAndUserId(Long id, Long userId);
}
